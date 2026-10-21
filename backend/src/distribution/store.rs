use super::{DESTINATIONS, Delivery, Error, Outcome, Result, hash};
use serde_json::{Value, json};
use sqlx::{PgPool, Row};
use std::collections::BTreeSet;
use uuid::Uuid;

pub struct Store(pub PgPool);
impl Store {
    pub async fn known_batches(&self) -> Result<std::collections::BTreeMap<String, String>> {
        sqlx::query_as("SELECT request_id,file_hash FROM public.distribution_batches")
            .fetch_all(&self.0)
            .await
            .map(|rows: Vec<(String, String)>| rows.into_iter().collect())
            .map_err(|_| Error("distribution-database"))
    }

    pub async fn ingest(
        &self,
        publications: &[(String, Option<String>, Value)],
        receipt: &Value,
        configured: &BTreeSet<String>,
        file_hash: &str,
        verified_at: u64,
    ) -> Result<()> {
        let mut transaction = self
            .0
            .begin()
            .await
            .map_err(|_| Error("distribution-database"))?;
        let initialized: bool = sqlx::query_scalar(
            "SELECT initialized FROM public.distribution_state WHERE singleton FOR UPDATE",
        )
        .fetch_one(&mut *transaction)
        .await
        .map_err(|_| Error("distribution-database"))?;
        let request = receipt
            .get("requestId")
            .and_then(Value::as_str)
            .ok_or(Error("invalid-publication-evidence"))?;
        if !super::hexadecimal(file_hash, 64) || verified_at == 0 || verified_at > i64::MAX as u64 {
            return Err(Error("invalid-publication-evidence"));
        }
        let stored: Option<String> = sqlx::query_scalar(
            "SELECT file_hash FROM public.distribution_batches WHERE request_id=$1",
        )
        .bind(request)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|_| Error("distribution-database"))?;
        if let Some(stored) = stored {
            if stored != file_hash {
                return Err(Error("publication-receipt-conflict"));
            }
            return transaction
                .commit()
                .await
                .map_err(|_| Error("distribution-database"));
        }
        let mut accepted = Vec::new();
        let mut conflicts = Vec::new();
        for (id, package_hash, payload) in publications {
            let payload_hash = hash(payload)?;
            let existing = sqlx::query("SELECT payload_hash,package_hash FROM public.distribution_publications WHERE collection_id=$1")
                .bind(id).fetch_optional(&mut *transaction).await.map_err(|_| Error("distribution-database"))?;
            if let Some(existing) = existing {
                let expected = existing.get::<String, _>("payload_hash");
                if expected != payload_hash
                    || existing.get::<Option<String>, _>("package_hash") != *package_hash
                {
                    conflicts.push(json!({"collectionId":id,"expectedPayloadHash":expected,"incomingPayloadHash":payload_hash}));
                    sqlx::query("UPDATE public.distribution_deliveries SET state='blocked',error_code='publication-payload-conflict' WHERE collection_id=$1 AND state IN ('pending','retryable','blocked')")
                        .bind(id).execute(&mut *transaction).await.map_err(|_| Error("distribution-database"))?;
                }
            } else {
                accepted.push((id, package_hash, payload, payload_hash));
            }
        }
        sqlx::query("INSERT INTO public.distribution_batches(request_id,file_hash,receipt,verified_at,publication_conflicts) VALUES($1,$2,$3,$4,$5)")
            .bind(request).bind(file_hash).bind(receipt).bind(verified_at as i64).bind(json!(conflicts))
            .execute(&mut *transaction).await.map_err(|_| Error("distribution-database"))?;
        for (id, package_hash, payload, payload_hash) in accepted {
            sqlx::query("INSERT INTO public.distribution_publications(collection_id,package_hash,payload_hash,payload,receipt,baseline) VALUES($1,$2,$3,$4,$5,$6)")
                .bind(id).bind(package_hash).bind(payload_hash).bind(payload).bind(receipt).bind(!initialized)
                .execute(&mut *transaction).await.map_err(|_| Error("distribution-database"))?;
            if initialized {
                for (destination, _) in DESTINATIONS {
                    enqueue(
                        &mut transaction,
                        id,
                        payload,
                        destination,
                        configured.contains(destination),
                    )
                    .await?;
                }
            }
        }
        sqlx::query("UPDATE public.distribution_state SET initialized=true WHERE singleton")
            .execute(&mut *transaction)
            .await
            .map_err(|_| Error("distribution-database"))?;
        transaction
            .commit()
            .await
            .map_err(|_| Error("distribution-database"))
    }

    pub async fn claim(&self) -> Result<Option<Delivery>> {
        let claim = Uuid::new_v4();
        let mut transaction = self
            .0
            .begin()
            .await
            .map_err(|_| Error("distribution-database"))?;
        let row = sqlx::query("WITH candidate AS MATERIALIZED (
SELECT delivery.collection_id,delivery.destination,delivery.item,delivery.state='unknown' AS reconcile
FROM public.distribution_deliveries delivery JOIN public.distribution_publications publication USING(collection_id)
WHERE (delivery.state IN ('pending','retryable') OR (delivery.state='unknown' AND delivery.destination='telegram' AND delivery.item='emoji-set'))
AND delivery.next_attempt_at <= clock_timestamp()
AND NOT EXISTS(SELECT 1 FROM public.distribution_batches batch WHERE batch.publication_conflicts @> jsonb_build_array(jsonb_build_object('collectionId',delivery.collection_id)))
AND (delivery.destination<>'telegram' OR delivery.item<>'album' OR EXISTS(
    SELECT 1 FROM public.distribution_deliveries emoji WHERE emoji.collection_id=delivery.collection_id AND emoji.destination='telegram' AND emoji.item='emoji-set' AND emoji.state='delivered'))
AND (delivery.destination<>'telegram' OR delivery.item<>'emoji-set' OR NOT EXISTS(
    SELECT 1 FROM public.distribution_deliveries earlier JOIN public.distribution_publications prior USING(collection_id)
    WHERE earlier.destination='telegram' AND earlier.item='emoji-set'
    AND earlier.collection_id<>delivery.collection_id
    AND ((earlier.state<>'delivered' AND earlier.progress<>'{}'::jsonb) OR earlier.state='in-flight'
        OR (delivery.progress='{}'::jsonb AND earlier.state IN ('pending','retryable','unknown')
            AND (prior.created_at,earlier.collection_id)<(publication.created_at,delivery.collection_id)))))
ORDER BY delivery.next_attempt_at,delivery.collection_id,delivery.destination,delivery.item FOR UPDATE OF delivery SKIP LOCKED LIMIT 1)
UPDATE public.distribution_deliveries delivery SET state='in-flight',generation=delivery.generation+1,claim_id=$1,claimed_at=clock_timestamp(),error_code=NULL
FROM candidate WHERE (delivery.collection_id,delivery.destination,delivery.item)=(candidate.collection_id,candidate.destination,candidate.item) RETURNING delivery.*,candidate.reconcile")
            .bind(claim).fetch_optional(&mut *transaction).await.map_err(|_| Error("distribution-database"))?;
        let Some(row) = row else {
            return Ok(None);
        };
        let delivery = Delivery {
            collection_id: row.get("collection_id"),
            destination: row.get("destination"),
            item: row.get("item"),
            claim,
            generation: row.get("generation"),
            payload: row.get("payload"),
            progress: row.get("progress"),
            reconcile: row.get("reconcile"),
        };
        sqlx::query("INSERT INTO public.distribution_attempts(claim_id,collection_id,destination,item,generation,outcome) VALUES($1,$2,$3,$4,$5,'in-flight')")
            .bind(claim).bind(&delivery.collection_id).bind(&delivery.destination).bind(&delivery.item).bind(delivery.generation)
            .execute(&mut *transaction).await.map_err(|_| Error("distribution-database"))?;
        transaction
            .commit()
            .await
            .map_err(|_| Error("distribution-database"))?;
        Ok(Some(delivery))
    }

    pub async fn telegram_receipt(&self, collection: Option<&str>) -> Result<Option<Value>> {
        sqlx::query_scalar("SELECT delivery.remote_receipt FROM public.distribution_deliveries delivery JOIN public.distribution_publications publication USING(collection_id) LEFT JOIN public.distribution_attempts attempt ON (attempt.collection_id,attempt.destination,attempt.item,attempt.generation)=(delivery.collection_id,delivery.destination,delivery.item,delivery.generation) AND attempt.outcome='delivered' WHERE delivery.destination='telegram' AND delivery.item='emoji-set' AND delivery.state='delivered' AND ($1::text IS NULL OR delivery.collection_id=$1) ORDER BY COALESCE(attempt.finished_at,delivery.resolved_at,publication.created_at) DESC,delivery.collection_id DESC LIMIT 1")
            .bind(collection).fetch_optional(&self.0).await.map_err(|_| Error("distribution-database"))
    }

    pub async fn finish(&self, delivery: &Delivery, outcome: Outcome) -> Result<()> {
        let (state, receipt, progress, delay, code) = match outcome {
            Outcome::Delivered(receipt) => (
                "delivered",
                Some(receipt),
                delivery.progress.clone(),
                0,
                None,
            ),
            Outcome::Progress(progress) => ("pending", None, progress, 0, None),
            Outcome::Retry { seconds, code } => (
                "retryable",
                None,
                delivery.progress.clone(),
                seconds,
                Some(code),
            ),
            Outcome::Unknown(code) => ("unknown", None, delivery.progress.clone(), 300, Some(code)),
            Outcome::Blocked(code) => ("blocked", None, delivery.progress.clone(), 0, Some(code)),
        };
        if delay > i32::MAX as u32
            || !progress.is_object()
            || receipt.as_ref().is_some_and(|item| !item.is_object())
        {
            return Err(Error("invalid-delivery-outcome"));
        }
        let mut transaction = self
            .0
            .begin()
            .await
            .map_err(|_| Error("distribution-database"))?;
        let changed = sqlx::query("UPDATE public.distribution_deliveries SET state=$1,remote_receipt=$2,progress=$3,next_attempt_at=clock_timestamp()+($4::bigint * interval '1 second'),error_code=$5,claim_id=NULL,claimed_at=NULL WHERE collection_id=$6 AND destination=$7 AND item=$8 AND claim_id=$9 AND generation=$10 AND state='in-flight'")
            .bind(state).bind(&receipt).bind(progress).bind(i64::from(delay)).bind(code).bind(&delivery.collection_id).bind(&delivery.destination).bind(&delivery.item)
            .bind(delivery.claim).bind(delivery.generation).execute(&mut *transaction).await.map_err(|_| Error("distribution-database"))?.rows_affected();
        if changed != 1 {
            return Err(Error("distribution-stale-claim"));
        }
        sqlx::query("UPDATE public.distribution_attempts SET outcome=$1,error_code=$2,remote_receipt=$3,finished_at=clock_timestamp() WHERE claim_id=$4 AND outcome='in-flight'")
            .bind(state).bind(code).bind(receipt).bind(delivery.claim).execute(&mut *transaction).await.map_err(|_| Error("distribution-database"))?;
        transaction
            .commit()
            .await
            .map_err(|_| Error("distribution-database"))
    }

    pub async fn recover(&self) -> Result<u64> {
        let mut transaction = self
            .0
            .begin()
            .await
            .map_err(|_| Error("distribution-database"))?;
        let changed = sqlx::query("WITH expired AS (UPDATE public.distribution_deliveries SET state='unknown',error_code='worker-interrupted',claim_id=NULL,claimed_at=NULL WHERE state='in-flight' AND claimed_at < clock_timestamp()-interval '5 minutes' RETURNING collection_id,destination,item,generation) UPDATE public.distribution_attempts attempt SET outcome='unknown',error_code='worker-interrupted',finished_at=clock_timestamp() FROM expired WHERE (attempt.collection_id,attempt.destination,attempt.item,attempt.generation)=(expired.collection_id,expired.destination,expired.item,expired.generation) AND attempt.outcome='in-flight'")
            .execute(&mut *transaction).await.map_err(|_| Error("distribution-database"))?.rows_affected();
        transaction
            .commit()
            .await
            .map_err(|_| Error("distribution-database"))?;
        Ok(changed)
    }

    pub async fn select(&self, collection: &str, destination: &str) -> Result<u64> {
        if !DESTINATIONS.iter().any(|(name, _)| *name == destination) {
            return Err(Error("invalid-destination"));
        }
        let mut transaction = self
            .0
            .begin()
            .await
            .map_err(|_| Error("distribution-database"))?;
        sqlx::query("SELECT initialized FROM public.distribution_state WHERE singleton FOR UPDATE")
            .execute(&mut *transaction)
            .await
            .map_err(|_| Error("distribution-database"))?;
        let conflict: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM public.distribution_batches WHERE publication_conflicts @> $1::jsonb)")
            .bind(json!([{"collectionId":collection}])).fetch_one(&mut *transaction).await.map_err(|_|Error("distribution-database"))?;
        if conflict {
            return Err(Error("publication-metadata-conflict"));
        }
        let payload: Value = sqlx::query_scalar(
            "SELECT payload FROM public.distribution_publications WHERE collection_id=$1 FOR SHARE",
        )
        .bind(collection)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|_| Error("publication-not-found"))?;
        if payload.get("blockedReason").is_some() {
            return Err(Error("publication-package-unverified"));
        }
        enqueue(&mut transaction, collection, &payload, destination, false).await?;
        let changed = sqlx::query("UPDATE public.distribution_deliveries SET state='pending',error_code=NULL,next_attempt_at=clock_timestamp(),selected_at=clock_timestamp() WHERE collection_id=$1 AND destination=$2 AND state='blocked'")
            .bind(collection).bind(destination).execute(&mut *transaction).await.map_err(|_| Error("distribution-database"))?.rows_affected();
        transaction
            .commit()
            .await
            .map_err(|_| Error("distribution-database"))?;
        Ok(changed)
    }

    pub async fn resolve(
        &self,
        collection: &str,
        destination: &str,
        item: &str,
        expected_hash: &str,
        receipt: Option<&Value>,
    ) -> Result<()> {
        if let Some(value) = receipt {
            let resolution: super::ResolutionReceipt = serde_json::from_value(value.clone())
                .map_err(|_| Error("invalid-resolution-receipt"))?;
            if !resolution.matches(collection, destination, item) {
                return Err(Error("invalid-resolution-receipt"));
            }
        }
        let changed = sqlx::query("UPDATE public.distribution_deliveries SET state=$1,remote_receipt=$2,error_code=NULL,next_attempt_at=clock_timestamp(),resolved_at=clock_timestamp() WHERE collection_id=$3 AND destination=$4 AND item=$5 AND payload_hash=$6 AND state='unknown' AND ($2::jsonb IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.distribution_batches WHERE publication_conflicts @> $7::jsonb))")
            .bind(if receipt.is_some() { "delivered" } else { "pending" }).bind(receipt).bind(collection).bind(destination).bind(item).bind(expected_hash).bind(json!([{"collectionId":collection}]))
            .execute(&self.0).await.map_err(|_| Error("distribution-database"))?.rows_affected();
        if changed != 1 {
            return Err(Error("resolution-intent-mismatch"));
        }
        Ok(())
    }
}

async fn enqueue(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    id: &str,
    payload: &Value,
    destination: &str,
    ready: bool,
) -> Result<()> {
    let count = DESTINATIONS
        .iter()
        .find(|(name, _)| *name == destination)
        .ok_or(Error("invalid-destination"))?
        .1;
    let unavailable = payload.get("blockedReason").and_then(Value::as_str)
        == Some("publication-package-unverified");
    let ready = ready && !unavailable;
    for index in 1..=count {
        let item = if destination == "telegram" {
            if index == 1 {
                "emoji-set".to_owned()
            } else {
                "album".to_owned()
            }
        } else {
            format!("post-{index}")
        };
        let intent = json!({"collection": payload, "destination": destination, "item": item, "index": index});
        let payload_hash = hash(&intent)?;
        sqlx::query("INSERT INTO public.distribution_deliveries(collection_id,destination,item,payload_hash,payload,state,error_code) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING")
            .bind(id).bind(destination).bind(&item).bind(&payload_hash).bind(intent)
            .bind(if ready { "pending" } else { "blocked" }).bind(if ready { None } else { Some(if unavailable {"publication-package-unverified"} else {"destination-not-configured"}) })
            .execute(&mut **transaction).await.map_err(|_| Error("distribution-database"))?;
        let saved: String = sqlx::query_scalar("SELECT payload_hash FROM public.distribution_deliveries WHERE collection_id=$1 AND destination=$2 AND item=$3")
            .bind(id).bind(destination).bind(item).fetch_one(&mut **transaction).await.map_err(|_| Error("distribution-database"))?;
        if saved != payload_hash {
            return Err(Error("delivery-payload-conflict"));
        }
    }
    Ok(())
}
