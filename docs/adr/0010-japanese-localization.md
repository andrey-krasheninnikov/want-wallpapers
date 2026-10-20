# 0010: Japanese catalog and public locale

Status: accepted. Extends the four-locale contract in ADR 0004.

Japanese uses `ja` routes and the existing typed dictionaries, static catalog snapshot, Lunr search and versioned gallery data. Public content includes complete collection stories and every catalog title and description. The visual system stays unchanged; Japanese glyphs use self-hosted Noto Sans JP with Japanese line breaking.

Catalog writes and imports require exactly five nonempty translations: en, ru, zh-cn, pt-br and ja. Keeping ja optional would permit incomplete Japanese publications and silently losing translations through older writers. Four-locale manifests are therefore rejected, with the missing locale identified by catalog tools and the editor.

A new transactional SQLx migration adds missing Japanese translations to known records, preserves existing Japanese and all other fields, and advances affected optimistic versions. Changed English source or unknown untranslated records abort the transaction. Apply it with app stopped through the existing release procedure. Applied migrations and catalog identities are immutable. Do not remove translations for rollback; require explicit compatibility evidence or a forward fix.

No translation service or new i18n framework is introduced. The installed Lunr Japanese tokenizer serves index and query text; NFKC normalization preserves voiced kana. Existing Intl.Segmenter content checks retain the 200-word and greater-than-10-percent thresholds. Native links, original PNG filenames and the four existing locales remain compatible.
