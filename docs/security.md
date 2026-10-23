# Безопасность и зависимости

Проверка зависимостей: 4 октября 2026; transition directives пересмотрены 13 октября 2026; JSX/MDX rendering и legacy Zod пересмотрены 23 октября 2026. Следующая проверка обязательна не позднее 4 ноября 2026. Смена runtime, Astro features, версий override или появление новой advisory требует новой оценки. Эти исключения не означают чистый исходный audit.

```bash
cargo install cargo-audit --version 0.22.2 --locked
make audit
```

`make audit` запускает настоящие Bun/Cargo audit, принимает только перечисленные ниже advisory, проверяет условия и срок, отклоняет новые findings. Установка зависимостей использует frozen lockfile без lifecycle scripts. CI использует те же команды. Отчёт с сетевой ошибкой не считается успешным.

## Production

Production образ содержит только Rust binary, системные библиотеки и статические HTML/CSS/JS/PNG. Astro, Node/Bun, Sharp, esbuild и инструменты сборки не входят в final stage. Astro SSR, server islands и image optimizer отсутствуют. PNG загружаются только при сборке из фиксированного CDN, формат проверяется до обработки; сайт не принимает image upload. Редактирование каталога требует авторизации и не запускает сборку автоматически.

Cookie production имеют префикс `__Host-`, Secure, HttpOnly, SameSite=Strict, Path=/ и не задают Domain. Изменения требуют точного Origin и CSRF. Пароль Argon2id с TOTP, persistent replay/rate protection, отзыв сессий, лимиты тела/таймаутов и optimistic versions защищают административный API. Bearer secret ограничен каталогом. Runtime PostgreSQL роль не имеет владения объектами, memberships, CREATE/DDL и никакого доступа к истории миграций, включая column grants. `deploy/verify-runtime-grants.sql` проверяет effective/default grants read-only; отдельная reviewed hardening процедура применяется оператором только к выделенной БД при остановленном app. TLS verify-full проверяет сертификат и hostname PostgreSQL 18. CSP использует hashes inline scripts и не разрешает unsafe-inline scripts. Inline styles остаются разрешены для Radix; HTML-текст и значения атрибутов экранируются. JSON-LD отдельно экранирует `<`.

reCAPTCHA Enterprise обязательна для публичных изменений и admin login. Сервер проверяет valid/action/hostname/score; timeout или сбой провайдера блокирует запись. App использует internal proxy и отдельную egress сеть, не получает migrator credentials или Docker socket. Migrate подключается только к egress и получает только migrator URL/CA. Credentials Google доступны только runtime app из внешнего read-only файла. Миграция, frontend и CI их не получают. Токены, тексты форм, пароль и TOTP не включаются в журналы assessment. Origin, CSRF, ownership и лимиты сохраняются независимо от CAPTCHA.

## Оставшиеся Bun advisory

Astro 5 сохранён ради совместимости текущего frontend. Полное устранение metadata findings требует отдельной миграции major Astro и React integration. До следующей проверки действуют следующие ограничения:

| Advisory | Условие и контроль |
| --- | --- |
| [GHSA-xr5h-phrj-8vxv](https://github.com/withastro/astro/security/advisories/GHSA-xr5h-phrj-8vxv) | Server islands не используются, сервер Astro отсутствует. |
| [GHSA-j687-52p2-xcff](https://github.com/withastro/astro/security/advisories/GHSA-j687-52p2-xcff) | define:vars не используется; JSON-LD сериализуется с экранированием `<`. |
| [GHSA-jrpj-wcv7-9fh9](https://github.com/withastro/astro/security/advisories/GHSA-jrpj-wcv7-9fh9), [GHSA-f48w-9m4c-m7f5](https://github.com/withastro/astro/security/advisories/GHSA-f48w-9m4c-m7f5) | Astro spread attributes отсутствуют; имена атрибутов статические. React spread props не используют Astro renderer. |
| [GHSA-7pw4-f3q4-r2p2](https://github.com/withastro/astro/security/advisories/GHSA-7pw4-f3q4-r2p2) | В Base.astro допустимы только literal transition:persist="header", "cookies" и "feedback-root". Они не получают значения из URL, каталога или форм. Audit отклоняет другие значения, динамические directives и использование в других файлах. ClientRouter получает статические same-origin страницы; Astro SSR отсутствует. |
| [GHSA-4g3v-8h47-v7g6](https://github.com/withastro/astro/security/advisories/GHSA-4g3v-8h47-v7g6) | transition:animate и другие animation directives запрещены audit. Анимации заданы статически в CSS и не используют request-derived значения или Astro animation helpers. |
| [GHSA-2pvr-wf23-7pc7](https://github.com/withastro/astro/security/advisories/GHSA-2pvr-wf23-7pc7), [GHSA-376h-93r7-7g6f](https://github.com/withastro/astro/security/advisories/GHSA-376h-93r7-7g6f) | Runtime SSR и middleware Astro отсутствуют; Rust сам проверяет авторизацию независимо от URL статических страниц. |
| [GHSA-8hv8-536x-4wqp](https://github.com/withastro/astro/security/advisories/GHSA-8hv8-536x-4wqp) | Динамические slot names не используются. |
| [GHSA-26w7-cxv4-gfx2](https://github.com/withastro/astro/security/advisories/GHSA-26w7-cxv4-gfx2) | Все Sharp instances закреплены на 0.35.5 с исправленным libheif. Обработчик принимает проверенные PNG; runtime image optimizer отсутствует. Astro metadata по-прежнему отмечает finding. |
| [GHSA-98hj-9722-w3j8](https://github.com/withastro/astro/security/advisories/GHSA-98hj-9722-w3j8) | Уязвим Astro JSX/MDX renderer при динамических строках внутри script/style. Проект использует React JSX: audit требует jsx=react-jsx и jsxImportSource=react, запрещает MDX, Astro JSX/server runtime imports, JSX pragmas и script/style tags в JSX. Новое использование этих путей блокирует audit до отдельной оценки. Исправление upstream входит в Astro 7.3.2; текущая зависимость остаётся отмеченной audit. Срок оценки остаётся 4 ноября 2026. |

esbuild закреплён на 0.25.12: исправлен development CORS finding; более новая 0.28.1 несовместима с целевыми браузерами текущего Astro/Vite. [GHSA-g7r4-m6w7-qqqr](https://github.com/evanw/esbuild/security/advisories/GHSA-g7r4-m6w7-qqqr) относится к Windows development server; проект собирается на Linux/macOS и не использует esbuild serve. [GHSA-gv7w-rqvm-qjhr](https://github.com/evanw/esbuild/security/advisories/GHSA-gv7w-rqvm-qjhr) относится к Deno binary downloader; Deno не используется, зависимости npm установлены Bun по lockfile без install scripts. При добавлении Windows/Deno сценария сначала пересмотрите версию и ограничения.

21 октября 2026 Vite закреплён на 6.4.4 для устранения [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv). Advisory относится к Windows editor launcher; исправление применяется к сборочным зависимостям без нового исключения audit. Vite отсутствует в production runtime.

grpc-js 1.14.5 и http-cache-semantics 4.3.0 закреплены overrides для устранения найденных transitive advisory Firebase Analytics.

23 октября 2026 Zod 4 обновлён с 4.6.5 до 4.6.7. [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) исправлен для v4: превышение верхней границы array/set/map проверяется до разбора элементов. Регрессионная проверка oversized array подтверждает отказ до вызова element refinements.

Astro 5.18.2 и zod-to-ts 1.2.0 сохраняют Zod 3.25.76. Остаточный DoS в v3 не исправлен: превышение maxLength не прекращает обход элементов. [Upstream patch](https://github.com/colinhacks/zod/commit/a0ebf970f2d752e5f58527cd2942ff48be4f46bd) меняет только v4; совместимого stable v3 patch нет. Владелец разрешил временное исключение до 4 ноября 2026 только для двух точных legacy locators, используемых при сборке доверенной конфигурации и content types. Публичный API работает на Rust, приложение не использует Zod/Actions/Content schemas. Audit фиксирует все три Zod locators и версии, четырёх прямых потребителей Zod и static output; новые application/script/config imports Zod, его subpaths, Actions, Content, schema или DB останавливают проверку. Автоматически обнаруживаемые Content configs и Actions entrypoints также запрещены, включая конфигурацию без импортов. Недоверенные build-входы или изменение любого из этих условий требуют пересмотра. Исключение сохраняет остаточный риск сборки; оно не исправляет Zod 3 и не означает чистый исходный Bun audit.

## Cargo advisory

23 октября 2026 ctutils обновлён до 0.4.4 для устранения [RUSTSEC-2026-0385](https://rustsec.org/advisories/RUSTSEC-2026-0385.html), а Tokio до 1.53.3 для устранения [RUSTSEC-2026-0386](https://rustsec.org/advisories/RUSTSEC-2026-0386.html). Новые Rust advisory не исключаются из проверки.

19 октября 2026 rustls обновлён с 0.23.45 до 0.23.46 для устранения [RUSTSEC-2026-0347](https://rustsec.org/advisories/RUSTSEC-2026-0347.html). Advisory относится к отправке буферизованных данных после отказа ECH. Исправленная версия используется без дополнительного исключения audit.

21 октября 2026 обновлены rustls-webpki до 0.103.16, webpki-roots и webpki-root-certs до 1.0.10. Эти версии устраняют RUSTSEC-2026-0382, RUSTSEC-2026-0381 и RUSTSEC-2026-0383: проверка отклоняет скомпрометированные emSign intermediates, а наборы roots исключают соответствующий корневой сертификат.

SQLx 0.8 сохраняет compatibility crate webpki-roots 0.26.11. Его исходник содержит только реэкспорт `parent::TLS_SERVER_ROOTS`, а Cargo.lock связывает его с исправленным webpki-roots 1.0.10. Для metadata finding RUSTSEC-2026-0381 audit принимает только этот точный shim и двухстрочный registry dependency graph с родителем 1.0.10. Старый родитель, другая версия, локальная подмена или дополнительная зависимость блокируют проверку. Срок пересмотра остаётся 4 ноября 2026.

[RUSTSEC-2023-0071](https://rustsec.org/advisories/RUSTSEC-2023-0071.html) относится к `rsa` в optional SQLx MySQL зависимостях lockfile. MySQL не включён: production Linux graph с normal/build/dev dependencies не содержит rsa; используются только PostgreSQL и rustls-ring. Проверка графа обязательна перед принятием RSA finding. При включении RSA/MySQL исключение становится недействительным. Остальные Rust advisory/warnings блокируют проверку.

## Проверки

Build проверяет canonical/hreflang/OG, robots/sitemap, JSON-LD и CSP hashes всех HTML. Браузерные проверки используют Rust API, четыре языка, мобильные/desktop размеры, accessibility и административные операции. Compose contract проверяется через `make check` без настоящих secrets. Production image с фактическим Compose отдельно проверяется на PostgreSQL 18 с CA/hostname verification и непривилегированной ролью: `make docker-build`, затем `make test-container`. Native CI повторяет container проверки на linux/amd64 и linux/arm64 и публикует те же образы через artifacts. UI-проверки подменяют Firebase configuration, Installations, gtag и Analytics collection во всех вкладках, сохраняя production build settings. Тесты Google используют SDK stubs и synthetic credentials, поэтому не подтверждают настоящий assessment. Это локальные/CI проверки, не подтверждение VPS или HTTPS Traefik.
