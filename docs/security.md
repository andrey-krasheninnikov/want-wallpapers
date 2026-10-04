# Безопасность и зависимости

Проверка зависимостей: 4 октября 2026. Следующая проверка обязательна не позднее 4 ноября 2026. Смена runtime, Astro features, версий override или появление новой advisory требует новой оценки. Эти исключения не означают чистый исходный audit.

```bash
cargo install cargo-audit --version 0.22.2 --locked
make audit
```

`make audit` запускает настоящие Bun/Cargo audit, принимает только перечисленные ниже advisory, проверяет условия и срок, отклоняет новые findings. Установка зависимостей использует frozen lockfile без lifecycle scripts. CI использует те же команды. Отчёт с сетевой ошибкой не считается успешным.

## Production

Production образ содержит только Rust binary, системные библиотеки и статические HTML/CSS/JS/PNG. Astro, Node/Bun, Sharp, esbuild и инструменты сборки не входят в final stage. Astro SSR, server islands и image optimizer отсутствуют. PNG загружаются только при сборке из фиксированного CDN, формат проверяется до обработки; сайт не принимает image upload. Редактирование каталога требует авторизации и не запускает сборку автоматически.

Cookie production имеют префикс `__Host-`, Secure, HttpOnly, SameSite=Strict, Path=/ и не задают Domain. Изменения требуют точного Origin и CSRF. Пароль Argon2id с TOTP, persistent replay/rate protection, отзыв сессий, лимиты тела/таймаутов и optimistic versions защищают административный API. Bearer secret ограничен каталогом. Runtime PostgreSQL роль не имеет DDL и доступа к изменению истории миграций. TLS verify-full проверяет сертификат и hostname PostgreSQL 18. CSP использует hashes inline scripts и не разрешает unsafe-inline scripts. Inline styles остаются разрешены для Radix; HTML-текст и значения атрибутов экранируются. JSON-LD отдельно экранирует `<`.

reCAPTCHA Enterprise обязательна для публичных изменений и admin login. Сервер проверяет valid/action/hostname/score; timeout или сбой провайдера блокирует запись. Credentials доступны только runtime app из внешнего read-only файла. Миграция, frontend и CI их не получают. Токены, тексты форм, пароль и TOTP не включаются в журналы assessment. Origin, CSRF, ownership и лимиты сохраняются независимо от CAPTCHA.

## Оставшиеся Bun advisory

Astro 5 сохранён ради совместимости текущего frontend. Полное устранение metadata findings требует отдельной миграции major Astro и React integration. До следующей проверки действуют следующие ограничения:

| Advisory | Условие и контроль |
| --- | --- |
| [GHSA-xr5h-phrj-8vxv](https://github.com/withastro/astro/security/advisories/GHSA-xr5h-phrj-8vxv) | Server islands не используются, сервер Astro отсутствует. |
| [GHSA-j687-52p2-xcff](https://github.com/withastro/astro/security/advisories/GHSA-j687-52p2-xcff) | define:vars не используется; JSON-LD сериализуется с экранированием `<`. |
| [GHSA-jrpj-wcv7-9fh9](https://github.com/withastro/astro/security/advisories/GHSA-jrpj-wcv7-9fh9), [GHSA-f48w-9m4c-m7f5](https://github.com/withastro/astro/security/advisories/GHSA-f48w-9m4c-m7f5) | Astro spread attributes отсутствуют; имена атрибутов статические. React spread props не используют Astro renderer. |
| [GHSA-7pw4-f3q4-r2p2](https://github.com/withastro/astro/security/advisories/GHSA-7pw4-f3q4-r2p2), [GHSA-4g3v-8h47-v7g6](https://github.com/withastro/astro/security/advisories/GHSA-4g3v-8h47-v7g6) | transition directives не используются. |
| [GHSA-2pvr-wf23-7pc7](https://github.com/withastro/astro/security/advisories/GHSA-2pvr-wf23-7pc7), [GHSA-376h-93r7-7g6f](https://github.com/withastro/astro/security/advisories/GHSA-376h-93r7-7g6f) | Runtime SSR и middleware Astro отсутствуют; Rust сам проверяет авторизацию независимо от URL статических страниц. |
| [GHSA-8hv8-536x-4wqp](https://github.com/withastro/astro/security/advisories/GHSA-8hv8-536x-4wqp) | Динамические slot names не используются. |
| [GHSA-26w7-cxv4-gfx2](https://github.com/withastro/astro/security/advisories/GHSA-26w7-cxv4-gfx2) | Все Sharp instances закреплены на 0.35.5 с исправленным libheif. Обработчик принимает проверенные PNG; runtime image optimizer отсутствует. Astro metadata по-прежнему отмечает finding. |

esbuild закреплён на 0.25.12: исправлен development CORS finding; более новая 0.28.1 несовместима с целевыми браузерами текущего Astro/Vite. [GHSA-g7r4-m6w7-qqqr](https://github.com/evanw/esbuild/security/advisories/GHSA-g7r4-m6w7-qqqr) относится к Windows development server; проект собирается на Linux/macOS и не использует esbuild serve. [GHSA-gv7w-rqvm-qjhr](https://github.com/evanw/esbuild/security/advisories/GHSA-gv7w-rqvm-qjhr) относится к Deno binary downloader; Deno не используется, зависимости npm установлены Bun по lockfile без install scripts. При добавлении Windows/Deno сценария сначала пересмотрите версию и ограничения.

grpc-js 1.14.5 и http-cache-semantics 4.3.0 закреплены overrides для устранения найденных transitive advisory Firebase Analytics.

## Cargo advisory

[RUSTSEC-2023-0071](https://rustsec.org/advisories/RUSTSEC-2023-0071.html) относится к `rsa` в optional SQLx MySQL зависимостях lockfile. MySQL не включён: production Linux graph с normal/build/dev dependencies не содержит rsa; используются только PostgreSQL и rustls-ring. Проверка графа обязательна перед принятием этого единственного finding. При включении RSA/MySQL исключение становится недействительным. Остальные Rust advisory/warnings блокируют проверку.

## Проверки

Build проверяет canonical/hreflang/OG, robots/sitemap, JSON-LD и CSP hashes всех HTML. Браузерные проверки используют Rust API, четыре языка, мобильные/desktop размеры, accessibility и административные операции. Production image отдельно проверяется на PostgreSQL 18 с CA/hostname verification и непривилегированной ролью: `make docker-build`, затем `make test-container`. Native CI повторяет container проверки на linux/amd64 и linux/arm64 и публикует те же образы через artifacts. Тесты Google используют SDK stubs и synthetic credentials, поэтому не подтверждают настоящий assessment. Это локальные/CI проверки, не подтверждение VPS или HTTPS Traefik.
