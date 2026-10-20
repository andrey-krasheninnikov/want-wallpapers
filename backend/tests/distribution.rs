use serde_json::{Value, json};
use sqlx::{PgPool, Row};
use std::collections::BTreeSet;
use want_wallpapers_server::distribution::{Batch, Outcome, hash, store::Store};

fn batch(number: u8, ids: &[&str]) -> Batch {
    serde_json::from_value(json!({"schemaVersion":1,"verifiedAt":u64::from(number)+1,"receipt":{
        "requestId":format!("{number:032x}"),"tag":"v1.10.0","sourceSha":"a".repeat(40),"revision":"a".repeat(40),
        "indexDigest":format!("sha256:{}","b".repeat(64)),"architecture":"amd64","state":"succeeded","stage":"complete","backupVerified":true},
        "publications":ids.iter().map(|id|json!({"collectionId":id,"package":null})).collect::<Vec<_>>() })).unwrap()
}
async fn ingest(store: &Store, number: u8, ids: &[&str], configured: &[&str]) {
    batch(number, ids)
        .ingest(
            store,
            &configured
                .iter()
                .map(|value| (*value).into())
                .collect::<BTreeSet<_>>(),
            &format!("{number:064x}"),
        )
        .await
        .unwrap();
}
async fn count(pool: &PgPool, condition: &str) -> i64 {
    sqlx::query_scalar(&format!(
        "SELECT count(*) FROM distribution_deliveries WHERE {condition}"
    ))
    .fetch_one(pool)
    .await
    .unwrap()
}

#[sqlx::test(migrations = "./migrations")]
async fn baseline_repeat_missed_manual_and_payload_conflicts(pool: PgPool) {
    let store = Store(pool.clone());
    ingest(&store, 0, &["0001-old"], &["telegram"]).await;
    assert_eq!(count(&pool, "true").await, 0);
    ingest(
        &store,
        1,
        &["0001-old", "0002-missed", "0003-manual"],
        &["telegram"],
    )
    .await;
    assert_eq!(count(&pool, "state='pending'").await, 4);
    assert_eq!(count(&pool, "state='blocked'").await, 32);
    ingest(
        &store,
        1,
        &["0001-old", "0002-missed", "0003-manual"],
        &["telegram"],
    )
    .await;
    assert_eq!(count(&pool, "true").await, 36);
    assert!(
        batch(1, &["0001-old"])
            .ingest(&store, &BTreeSet::new(), &"f".repeat(64))
            .await
            .is_err()
    );
    let mut changed = batch(2, &["0001-old", "0004-independent"]);
    changed.publications[0].package = Some(
        json!({"schemaVersion":1,"packageHash":"e".repeat(64),"manifest":{"collection":{"id":"0001-old"}}}),
    );
    changed
        .ingest(
            &store,
            &["telegram".to_owned()].into_iter().collect(),
            &"c".repeat(64),
        )
        .await
        .unwrap();
    let conflicts: Value = sqlx::query_scalar(
        "SELECT publication_conflicts FROM distribution_batches WHERE request_id=$1",
    )
    .bind(format!("{:032x}", 2))
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(conflicts.as_array().unwrap().len(), 1);
    assert_eq!(conflicts[0]["collectionId"], "0001-old");
    assert_eq!(
        count(
            &pool,
            "collection_id='0004-independent' AND state='pending'"
        )
        .await,
        2
    );
    let original: Value = sqlx::query_scalar(
        "SELECT payload FROM distribution_publications WHERE collection_id='0001-old'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(original, json!({"collectionId":"0001-old"}));
    assert_eq!(store.select("0001-old", "tumblr").await.unwrap(), 1);
    assert_eq!(store.select("0001-old", "tumblr").await.unwrap(), 0);
    let mut failed = batch(3, &["0004-failed"]);
    failed.receipt.state = "failed".into();
    assert!(
        failed
            .ingest(&store, &BTreeSet::new(), &"d".repeat(64))
            .await
            .is_err()
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn concurrent_claims_skip_locked_rows_and_commit_before_delivery(pool: PgPool) {
    let store = Store(pool.clone());
    ingest(&store, 0, &["0001-old"], &[]).await;
    ingest(&store, 1, &["0002-new"], &["pinterest"]).await;
    let mut locked = pool.begin().await.unwrap();
    let item:String=sqlx::query_scalar("SELECT item FROM distribution_deliveries WHERE state='pending' ORDER BY item LIMIT 1 FOR UPDATE").fetch_one(&mut *locked).await.unwrap();
    let (first, second) = tokio::join!(store.claim(), store.claim());
    let first = first.unwrap().unwrap();
    let second = second.unwrap().unwrap();
    assert_ne!(first.claim, second.claim);
    assert_ne!(first.item, second.item);
    assert_ne!(first.item, item);
    assert_ne!(second.item, item);
    // A second connection can lock a claimed row while network delivery would run.
    let mut observer = pool.begin().await.unwrap();
    sqlx::query("SELECT 1 FROM distribution_deliveries WHERE claim_id=$1 FOR UPDATE NOWAIT")
        .bind(first.claim)
        .execute(&mut *observer)
        .await
        .unwrap();
    observer.rollback().await.unwrap();
    store
        .finish(&first, Outcome::Delivered(json!({"remoteId":"one"})))
        .await
        .unwrap();
    store
        .finish(&second, Outcome::Blocked("confirmed-rejection"))
        .await
        .unwrap();
    locked.rollback().await.unwrap();
    let next = store.claim().await.unwrap().unwrap();
    assert_eq!(next.item, item);
}

#[sqlx::test(migrations = "./migrations")]
async fn partial_success_rate_limit_progress_and_unknown_stay_independent(pool: PgPool) {
    let store = Store(pool.clone());
    ingest(&store, 0, &["0001-old"], &[]).await;
    ingest(&store, 1, &["0002-new"], &["pinterest"]).await;
    let delivered = store.claim().await.unwrap().unwrap();
    store
        .finish(&delivered, Outcome::Delivered(json!({"remoteId":"one"})))
        .await
        .unwrap();
    let retry = store.claim().await.unwrap().unwrap();
    store
        .finish(
            &retry,
            Outcome::Retry {
                seconds: 3600,
                code: "provider-rate-limit",
            },
        )
        .await
        .unwrap();
    assert!(sqlx::query_scalar::<_,bool>("SELECT next_attempt_at > clock_timestamp()+interval '59 minutes' FROM distribution_deliveries WHERE item=$1 AND destination='pinterest'").bind(&retry.item).fetch_one(&pool).await.unwrap());
    let unknown = store.claim().await.unwrap().unwrap();
    store
        .finish(&unknown, Outcome::Unknown("provider-write-outcome-unknown"))
        .await
        .unwrap();
    let progress = store.claim().await.unwrap().unwrap();
    store
        .finish(&progress, Outcome::Progress(json!({"uploadId":"staged"})))
        .await
        .unwrap();
    assert_eq!(count(&pool, "state='delivered'").await, 1);
    assert_eq!(count(&pool, "state='unknown'").await, 1);
    assert_eq!(count(&pool, "state='retryable'").await, 1);
    let row=sqlx::query("SELECT progress,generation FROM distribution_deliveries WHERE claim_id IS NULL AND item=$1 AND destination='pinterest'").bind(&progress.item).fetch_one(&pool).await.unwrap();
    assert_eq!(
        row.get::<Value, _>("progress"),
        json!({"uploadId":"staged"})
    );
    assert_eq!(
        store
            .finish(&progress, Outcome::Blocked("late-result"))
            .await
            .unwrap_err()
            .0,
        "distribution-stale-claim"
    );
    assert_eq!(store.select("0002-new", "pinterest").await.unwrap(), 0);
}

#[sqlx::test(migrations = "./migrations")]
async fn restart_fences_old_attempts_and_requires_explicit_reconciliation(pool: PgPool) {
    let store = Store(pool.clone());
    ingest(&store, 0, &["0001-old"], &[]).await;
    ingest(&store, 1, &["0002-new"], &["tumblr"]).await;
    let first = store.claim().await.unwrap().unwrap();
    sqlx::query("UPDATE distribution_deliveries SET claimed_at=clock_timestamp()-interval '6 minutes' WHERE claim_id=$1").bind(first.claim).execute(&pool).await.unwrap();
    assert_eq!(store.recover().await.unwrap(), 1);
    assert!(store.claim().await.unwrap().is_none());
    assert_eq!(
        store
            .finish(&first, Outcome::Delivered(json!({"remoteId":"stale"})))
            .await
            .unwrap_err()
            .0,
        "distribution-stale-claim"
    );
    assert!(
        store
            .resolve(
                &first.collection_id,
                &first.destination,
                &first.item,
                &"f".repeat(64),
                None
            )
            .await
            .is_err()
    );
    let credentials =
        json!({"enabled":true,"accessToken":"private-value","refreshToken":"private-value"});
    assert_eq!(
        store
            .resolve(
                &first.collection_id,
                &first.destination,
                &first.item,
                &hash(&first.payload).unwrap(),
                Some(&credentials)
            )
            .await
            .unwrap_err()
            .0,
        "invalid-resolution-receipt"
    );
    assert_eq!(
        count(&pool, "state='unknown' AND remote_receipt IS NULL").await,
        1
    );
    store
        .resolve(
            &first.collection_id,
            &first.destination,
            &first.item,
            &hash(&first.payload).unwrap(),
            None,
        )
        .await
        .unwrap();
    let second = store.claim().await.unwrap().unwrap();
    assert_eq!(second.generation, first.generation + 1);
    store
        .finish(&second, Outcome::Delivered(json!({"remoteId":"verified"})))
        .await
        .unwrap();
    assert_eq!(count(&pool, "state='delivered'").await, 1);
    assert!(
        sqlx::query("UPDATE distribution_deliveries SET payload='{}'")
            .execute(&pool)
            .await
            .is_err()
    );
    let outcomes: Vec<String> =
        sqlx::query_scalar("SELECT outcome FROM distribution_attempts ORDER BY generation")
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(outcomes, ["unknown", "delivered"]);
}

#[sqlx::test(migrations = "./migrations")]
async fn worker_grants_exclude_application_data_ddl_and_migrations(pool: PgPool) {
    sqlx::raw_sql(
        "CREATE ROLE \"wallpapers-distributor\" LOGIN; REVOKE ALL ON SCHEMA public FROM PUBLIC;",
    )
    .execute(&pool)
    .await
    .unwrap();
    let database: String = sqlx::query_scalar("SELECT current_database()")
        .fetch_one(&pool)
        .await
        .unwrap();
    sqlx::raw_sql(&format!("REVOKE ALL ON DATABASE \"{database}\" FROM PUBLIC; GRANT CONNECT ON DATABASE \"{database}\" TO \"wallpapers-distributor\"; GRANT USAGE ON SCHEMA public TO \"wallpapers-distributor\";")).execute(&pool).await.unwrap();
    let grants = include_str!("../../deploy/distribution-grants.sql")
        .lines()
        .filter(|line| !line.starts_with('\\'))
        .collect::<Vec<_>>()
        .join("\n");
    sqlx::raw_sql(&grants).execute(&pool).await.unwrap();
    sqlx::raw_sql(include_str!("../../deploy/verify-distribution-grants.sql"))
        .execute(&pool)
        .await
        .unwrap();
    sqlx::raw_sql(
        "GRANT SELECT(version) ON public._sqlx_migrations TO \"wallpapers-distributor\";",
    )
    .execute(&pool)
    .await
    .unwrap();
    assert!(
        sqlx::raw_sql(include_str!("../../deploy/verify-distribution-grants.sql"))
            .execute(&pool)
            .await
            .is_err()
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn manual_receipt_binds_exact_delivery_and_remote_ids(pool: PgPool) {
    let store = Store(pool.clone());
    ingest(&store, 0, &["0001-old"], &[]).await;
    ingest(&store, 1, &["0002-new"], &["tumblr"]).await;
    let delivery = store.claim().await.unwrap().unwrap();
    store
        .finish(&delivery, Outcome::Unknown("unconfirmed"))
        .await
        .unwrap();
    let mut receipt = json!({"schemaVersion":1,"collectionId":delivery.collection_id,"destination":delivery.destination,"item":delivery.item,"remoteIds":["123456"]});
    receipt["item"] = json!("wrong");
    assert!(
        store
            .resolve(
                &delivery.collection_id,
                &delivery.destination,
                &delivery.item,
                &hash(&delivery.payload).unwrap(),
                Some(&receipt)
            )
            .await
            .is_err()
    );
    receipt["item"] = json!(delivery.item);
    store
        .resolve(
            &delivery.collection_id,
            &delivery.destination,
            &delivery.item,
            &hash(&delivery.payload).unwrap(),
            Some(&receipt),
        )
        .await
        .unwrap();
    assert_eq!(count(&pool, "state='delivered'").await, 1);
}
