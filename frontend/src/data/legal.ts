import type { Locale } from './catalog';
import { copy } from './copy';

export type LegalKey = 'privacy' | 'terms' | 'cookies' | 'license' | 'contact';
type Section = { heading: string; paragraphs: string[]; owner?: boolean };
type Page = { title: string; intro: string; sections: Section[] };

const content: Record<Locale, Record<LegalKey, Omit<Page, 'title'>>> = {
  en: {
    privacy: { intro: 'This page explains what happens to your data when you browse, download or leave a note.', sections: [
      { heading: 'Protection against abuse', paragraphs: ['When you submit a rating, comment, report or feedback, reCAPTCHA Enterprise sends technical browser data to Google. The server also sends your IP address, browser user agent and protection token to assess the request. Passwords, authenticator codes and message contents are not included. Administrator login uses the same protection. Browsing and downloads do not load reCAPTCHA.'] },
      { heading: 'Who operates this site', owner: true, paragraphs: ['wallpapers@want.foundation'] },
      { heading: 'Data we use', paragraphs: ['Cloudflare and the VPS hosting provider receive technical request data, including your IP address. Original images are also stored on the image host. The external IP lookup receives your IP address to determine default analytics and advertising preferences. Country results do not restrict ratings, comments or feedback and may be wrong.', 'If you rate or comment, the site creates an anonymous visitor identifier and keeps a secure session cookie in your browser. Your action is tied to that identifier. Feedback includes your topic, message and optional email. We do not ask for your name.', 'Analytics and advertising have independent preferences. For new visitors they default to enabled outside the European Economic Area (EEA). In the EEA or if the country is unknown, optional collection waits for an explicit choice. Stored refusals are preserved. Analytics runs only when configured. No advertising network is connected.'] },
      { heading: 'Storage and retention', paragraphs: ['Catalogue, ratings, comments and feedback are stored in PostgreSQL on an external database server. The site runs on a VPS and uses Timeweb S3, an external IP lookup and optional Firebase Analytics; processing locations depend on those services.', 'You can delete your own comment in the same browser. We keep published comments and ratings until removal or a deletion request. Closed feedback entries are deleted after one year. Write to wallpapers@want.foundation to ask about or request deletion of your data.'] },
    ] },
    terms: { intro: 'Please use Want Wallpapers with care for the work and the people here.', sections: [
      { heading: 'The site', paragraphs: ['You may browse, search and download wallpapers for personal use under the license below. Availability and features can change. We cannot promise uninterrupted access.'] },
      { heading: 'Comments and feedback', paragraphs: ['Do not post unlawful, abusive, misleading or spam content, or someone else’s personal data. We may remove comments or restrict misuse. A report asks us to review a comment; it does not remove it automatically.'] },
      { heading: 'Operator', owner: true, paragraphs: ['wallpapers@want.foundation'] },
    ] },
    cookies: { intro: 'Essential storage keeps the site secure. You can change analytics and advertising preferences independently without losing browsing, downloads or interactive features.', sections: [
      { heading: 'Security storage', paragraphs: ['reCAPTCHA can set the _GRECAPTCHA cookie when you use a protected action. This security check is independent of optional analytics. Google’s Privacy Policy and Terms of Service apply; links appear next to the protected forms.'] },
      { heading: 'Essential storage', paragraphs: ['Local storage keeps your cookie choice. Session storage keeps a known country code separately from feature availability. If you rate, comment or send feedback, an HttpOnly session cookie identifies your anonymous visitor session for up to one year. These features need this storage.'] },
      { heading: 'Optional analytics', paragraphs: ['Configured Firebase Analytics follows your analytics preference. For new visitors outside the EEA it defaults on; in the EEA or when the country is unknown it waits for your choice. Choose “Essential only” to refuse both optional purposes, or set them separately. Cookie settings in the footer let you withdraw permission and stop further collection.'] },
      { heading: 'Advertising', paragraphs: ['No advertising network is connected. Your advertising preference separately controls advertising storage, data use and personalization consent in Analytics. An old analytics-only choice never grants advertising permission. Before connecting an advertising provider, we will update the information and consent flow for that provider.'] },
    ] },
    license: { intro: 'The wallpapers are free to keep on your own screens.', sections: [
      { heading: 'You may', paragraphs: ['Download and use the original images as personal wallpapers on your devices, including a personal computer, phone or tablet. You may crop them for your own screen.'] },
      { heading: 'Please do not', paragraphs: ['Sell, redistribute or upload the images as a wallpaper pack; use them in advertising, products or other commercial work; or claim them as your own work. Ask wallpapers@want.foundation for any use beyond personal, noncommercial display.'] },
      { heading: 'Ownership', paragraphs: ['The images remain the property of their rights holder. This license grants limited use, not ownership.'] },
    ] },
    contact: { intro: 'A question, a licensing idea or a small detail we missed? Write to us.', sections: [
      { heading: 'Email', paragraphs: ['wallpapers@want.foundation'] },
      { heading: 'Operator', owner: true, paragraphs: [] },
    ] },
  },
  ru: {
    privacy: { intro: 'Здесь рассказываем, что происходит с данными при просмотре, скачивании и общении на сайте.', sections: [
      { heading: 'Защита от злоупотреблений', paragraphs: ['При отправке оценки, комментария, жалобы или обращения reCAPTCHA Enterprise передаёт технические данные браузера Google. Сервер также передаёт IP-адрес, сведения о браузере и токен защиты для проверки запроса. Пароли, коды аутентификатора и тексты сообщений не передаются. Вход администратора использует ту же защиту. Просмотр и скачивание не загружают reCAPTCHA.'] },
      { heading: 'Кто управляет сайтом', owner: true, paragraphs: ['wallpapers@want.foundation'] },
      { heading: 'Какие данные используются', paragraphs: ['Cloudflare и провайдер VPS получают технические данные запроса, включая IP-адрес. Оригинальные изображения также хранятся в хранилище изображений. Внешний сервис проверки страны получает IP-адрес, чтобы определить настройки аналитики и рекламы по умолчанию. Страна не ограничивает оценки, комментарии и обратную связь. Проверка может ошибаться.', 'При оценке или комментарии сайт создаёт анонимный идентификатор посетителя и сохраняет защищённый cookie сеанса в браузере. Действие связано с этим идентификатором. В форме обратной связи передаются тема, сообщение и необязательный email. Имя мы не запрашиваем.', 'Настройки аналитики и рекламы независимы. Для новых посетителей вне Европейской экономической зоны (ЕЭЗ) они включены по умолчанию. В ЕЭЗ и при неизвестной стране необязательный сбор ждёт явного выбора. Сохранённые отказы остаются в силе. Аналитика работает только при наличии настроек сервиса. Рекламная сеть пока не подключена.'] },
      { heading: 'Хранение и удаление', paragraphs: ['Каталог, оценки, комментарии и обращения хранятся в PostgreSQL на внешнем сервере базы данных. Сайт работает на VPS и использует Timeweb S3, внешний сервис проверки IP и необязательную Firebase Analytics. Места обработки зависят от этих сервисов.', 'Вы можете удалить свой комментарий в том же браузере. Опубликованные комментарии и оценки хранятся до удаления или запроса на удаление. Закрытые обращения удаляются через год. По вопросам данных и удаления пишите на wallpapers@want.foundation.'] },
    ] },
    terms: { intro: 'Пожалуйста, относитесь бережно к работам и людям на сайте.', sections: [
      { heading: 'Сайт', paragraphs: ['Можно просматривать, искать и скачивать обои для личного использования по лицензии ниже. Доступность сайта и функций может меняться; бесперебойная работа не гарантируется.'] },
      { heading: 'Комментарии и сообщения', paragraphs: ['Не публикуйте незаконные, оскорбительные, вводящие в заблуждение или рекламные сообщения и чужие персональные данные. Мы можем удалять комментарии и ограничивать злоупотребления. Жалоба отправляет комментарий на проверку, но не удаляет его автоматически.'] },
      { heading: 'Владелец', owner: true, paragraphs: ['wallpapers@want.foundation'] },
    ] },
    cookies: { intro: 'Необходимое хранение защищает сайт. Аналитикой и рекламой можно управлять независимо; просмотр, скачивания и интерактивные функции доступны при любом выборе.', sections: [
      { heading: 'Хранение для защиты', paragraphs: ['reCAPTCHA может установить cookie _GRECAPTCHA при выполнении защищённого действия. Проверка защиты не зависит от необязательной аналитики. Применяются Политика конфиденциальности и Условия использования Google; ссылки размещены рядом с защищёнными формами.'] },
      { heading: 'Необходимое хранение', paragraphs: ['Локальное хранилище запоминает выбор cookie. Хранилище сеанса сохраняет известный код страны отдельно от доступности функций. Для оценок, комментариев и формы HttpOnly cookie сохраняет анонимный сеанс посетителя сроком до одного года. Без этого хранения функции не работают.'] },
      { heading: 'Необязательная аналитика', paragraphs: ['Настроенная Firebase Analytics следует вашему выбору аналитики. Для новых посетителей вне ЕЭЗ она включена по умолчанию; в ЕЭЗ и при неизвестной стране ждёт вашего выбора. «Только необходимые» отключает обе необязательные категории, а настройки позволяют выбрать каждую отдельно. Через «Настройки cookie» внизу страницы можно отозвать разрешение и остановить дальнейший сбор.'] },
      { heading: 'Реклама', paragraphs: ['Рекламная сеть пока не подключена. Выбор рекламы отдельно управляет разрешениями на рекламное хранение, использование данных и персонализацию в Analytics. Прежний выбор только аналитики не разрешает рекламу. Перед подключением рекламного провайдера обновим сведения и согласие для этого провайдера.'] },
    ] },
    license: { intro: 'Обои можно бесплатно оставить на своих экранах.', sections: [
      { heading: 'Можно', paragraphs: ['Скачивать и использовать оригинальные изображения как личные обои на компьютере, телефоне или планшете. Можно обрезать их под свой экран.'] },
      { heading: 'Нельзя без разрешения', paragraphs: ['Продавать, распространять или загружать изображения как набор обоев; использовать их в рекламе, продуктах и другой коммерческой работе; выдавать за свои. Для другого использования напишите на wallpapers@want.foundation.'] },
      { heading: 'Права', paragraphs: ['Права на изображения остаются у правообладателя. Эта лицензия даёт ограниченное право использования, а не право собственности.'] },
    ] },
    contact: { intro: 'Вопрос, идея по лицензии или замеченная мелочь? Напишите нам.', sections: [
      { heading: 'Email', paragraphs: ['wallpapers@want.foundation'] },
      { heading: 'Владелец', owner: true, paragraphs: [] },
    ] },
  },
  'zh-cn': {
    privacy: { intro: '本页说明你浏览、下载或留言时，我们如何处理数据。', sections: [
      { heading: '防止滥用', paragraphs: ['提交评分、评论、举报或反馈时，reCAPTCHA Enterprise 会向 Google 发送浏览器技术数据。服务器也会发送 IP 地址、浏览器信息和验证令牌，以评估请求。密码、身份验证代码和留言内容不会发送。管理员登录使用同样的保护。浏览和下载不会加载 reCAPTCHA。'] },
      { heading: '网站运营者', owner: true, paragraphs: ['wallpapers@want.foundation'] },
      { heading: '使用的数据', paragraphs: ['Cloudflare 和 VPS 托管服务商会收到包含 IP 地址在内的技术请求数据。原始图片也保存在图片存储服务中。外部 IP 查询服务会收到 IP 地址，以确定分析和广告的默认设置。国家结果不会限制评分、评论或反馈，且可能有误。', '评分或评论时，网站会创建匿名访客标识符，并在浏览器中保存安全的会话 Cookie。操作会关联该标识符。反馈表单收集主题、留言和可选邮箱；我们不要求姓名。', '分析和广告设置相互独立。欧洲经济区（EEA）以外的新访客默认启用这两项设置。在 EEA 或国家未知时，可选数据收集等待明确选择。已保存的拒绝会被保留。分析服务仅在已配置时运行。目前未接入广告网络。'] },
      { heading: '存储与删除', paragraphs: ['目录、评分、评论和反馈存储在外部 PostgreSQL 数据库服务器上。网站运行于 VPS，并使用 Timeweb S3、外部 IP 查询服务和可选的 Firebase Analytics；处理地点取决于这些服务。', '你可在同一浏览器中删除自己的评论。评论和评分保留至删除或收到删除请求。已处理完的反馈在一年后删除。如需查询或删除数据，请联系 wallpapers@want.foundation。'] },
    ] },
    terms: { intro: '请尊重作品和这里的其他人。', sections: [
      { heading: '网站使用', paragraphs: ['你可根据下方许可浏览、搜索和下载壁纸供个人使用。网站和功能可能调整，无法保证持续可用。'] },
      { heading: '评论与反馈', paragraphs: ['请勿发布违法、辱骂、误导或垃圾内容，也不要发布他人的个人信息。我们可能删除评论或限制滥用。举报会提交审核，不会自动删除评论。'] },
      { heading: '运营者', owner: true, paragraphs: ['wallpapers@want.foundation'] },
    ] },
    cookies: { intro: '必要存储用于保护网站。分析和广告可独立设置；无论选择如何，都能浏览、下载和使用互动功能。', sections: [
      { heading: '安全存储', paragraphs: ['执行受保护的操作时，reCAPTCHA 可能设置 _GRECAPTCHA Cookie。安全验证不依赖可选分析。适用 Google 的隐私政策和服务条款；受保护表单旁提供链接。'] },
      { heading: '必要存储', paragraphs: ['本地存储保存 Cookie 选择；会话存储单独保存已知国家代码，不决定功能可用性。评分、评论或发送反馈时，HttpOnly Cookie 会保存匿名访客会话，期限最长为一年。相关功能需要这些存储。'] },
      { heading: '可选分析', paragraphs: ['已配置的 Firebase Analytics 遵循你的分析设置。EEA 以外的新访客默认启用分析；在 EEA 或国家未知时等待明确选择。“仅必要项”拒绝两项可选用途，也可分别设置。你可随时通过页脚的 Cookie 设置撤回许可，停止后续收集。'] },
      { heading: '广告', paragraphs: ['目前未接入广告网络。广告设置单独控制 Analytics 中广告存储、数据使用和个性化的许可。旧版仅允许分析的选择不授予广告许可。接入广告服务商前，我们会更新相关信息及其同意流程。'] },
    ] },
    license: { intro: '你可以免费将这些壁纸留在自己的屏幕上。', sections: [
      { heading: '允许的使用', paragraphs: ['下载原图并用于个人电脑、手机或平板的壁纸。你也可以为适配自己的屏幕裁剪图片。'] },
      { heading: '未经许可请勿', paragraphs: ['出售、重新分发或作为壁纸包上传图片；将其用于广告、产品或其他商业项目；声称作品由自己创作。其他用途请联系 wallpapers@want.foundation。'] },
      { heading: '权利归属', paragraphs: ['图片权利仍属于权利人。此许可只授予有限使用权，不转移所有权。'] },
    ] },
    contact: { intro: '有问题、许可合作想法，或发现了一个小细节？欢迎来信。', sections: [
      { heading: '邮箱', paragraphs: ['wallpapers@want.foundation'] },
      { heading: '运营者', owner: true, paragraphs: [] },
    ] },
  },
  'pt-br': {
    privacy: { intro: 'Esta página explica o que acontece com seus dados ao navegar, baixar ou enviar uma mensagem.', sections: [
      { heading: 'Proteção contra abuso', paragraphs: ['Ao enviar avaliações, comentários, denúncias ou mensagens, o reCAPTCHA Enterprise envia dados técnicos do navegador ao Google. O servidor também envia seu IP, informações do navegador e o token de proteção para avaliar a solicitação. Senhas, códigos do autenticador e conteúdo das mensagens não são enviados. O login administrativo usa a mesma proteção. Navegação e downloads não carregam o reCAPTCHA.'] },
      { heading: 'Responsável pelo site', owner: true, paragraphs: ['wallpapers@want.foundation'] },
      { heading: 'Dados utilizados', paragraphs: ['A Cloudflare e o provedor de hospedagem VPS recebem dados técnicos da requisição, incluindo o IP. As imagens originais também ficam no armazenamento de imagens. O serviço externo de consulta de IP recebe seu endereço para definir preferências padrão de análise e publicidade. O país não restringe avaliações, comentários ou feedback, e a consulta pode falhar.', 'Ao avaliar ou comentar, o site cria um identificador de visitante anônimo e mantém um cookie de sessão seguro no navegador. A ação fica associada ao identificador. O formulário recebe assunto, mensagem e email opcional. Não pedimos seu nome.', 'Análise e publicidade têm preferências independentes. Para novos visitantes fora do Espaço Econômico Europeu (EEE), elas são ativadas por padrão. No EEE ou quando o país é desconhecido, a coleta opcional aguarda uma escolha explícita. Recusas salvas são preservadas. A análise só funciona quando configurada. Nenhuma rede de anúncios está conectada.'] },
      { heading: 'Armazenamento e exclusão', paragraphs: ['Catálogo, avaliações, comentários e mensagens ficam no PostgreSQL em um servidor externo de banco de dados. O site funciona em um VPS e usa Timeweb S3, consulta externa de IP e Firebase Analytics opcional; os locais de processamento dependem desses serviços.', 'Você pode excluir seu comentário no mesmo navegador. Comentários e avaliações permanecem até a remoção ou solicitação de exclusão. Mensagens encerradas são excluídas após um ano. Para consultar ou pedir a exclusão de dados, escreva para wallpapers@want.foundation.'] },
    ] },
    terms: { intro: 'Use o Want Wallpapers com respeito pelas obras e pelas pessoas.', sections: [
      { heading: 'O site', paragraphs: ['Você pode navegar, buscar e baixar papéis de parede para uso pessoal conforme a licença abaixo. A disponibilidade e as funções podem mudar; não garantimos acesso ininterrupto.'] },
      { heading: 'Comentários e mensagens', paragraphs: ['Não publique conteúdo ilegal, ofensivo, enganoso ou spam, nem dados pessoais de terceiros. Podemos remover comentários ou limitar abusos. Uma denúncia solicita análise; não remove o comentário automaticamente.'] },
      { heading: 'Responsável', owner: true, paragraphs: ['wallpapers@want.foundation'] },
    ] },
    cookies: { intro: 'O armazenamento essencial protege o site. Análise e publicidade podem ser configuradas separadamente; navegação, downloads e funções interativas permanecem disponíveis com qualquer escolha.', sections: [
      { heading: 'Armazenamento de segurança', paragraphs: ['O reCAPTCHA pode definir o cookie _GRECAPTCHA ao executar uma ação protegida. A verificação não depende da análise opcional. Aplicam-se a Política de Privacidade e os Termos de Serviço do Google; os links aparecem junto dos formulários protegidos.'] },
      { heading: 'Armazenamento essencial', paragraphs: ['O armazenamento local guarda sua escolha de cookies. O armazenamento de sessão guarda um código de país conhecido separadamente da disponibilidade das funções. Ao avaliar, comentar ou enviar contato, um cookie HttpOnly identifica a sessão de visitante anônimo por até um ano. Essas funções precisam desse armazenamento.'] },
      { heading: 'Análise opcional', paragraphs: ['O Firebase Analytics configurado segue sua preferência de análise. Para novos visitantes fora do EEE, começa ativado; no EEE ou quando o país é desconhecido, aguarda sua escolha. “Só essenciais” recusa as duas finalidades opcionais, que também podem ser configuradas separadamente. As configurações de cookies no rodapé permitem retirar a autorização e interromper a coleta futura.'] },
      { heading: 'Publicidade', paragraphs: ['Nenhuma rede de anúncios está conectada. A preferência de publicidade controla separadamente permissões de armazenamento publicitário, uso de dados e personalização no Analytics. Uma escolha antiga de análise não concede permissão para publicidade. Antes de conectar um provedor, atualizaremos as informações e o consentimento correspondente.'] },
    ] },
    license: { intro: 'Os papéis de parede são gratuitos para suas próprias telas.', sections: [
      { heading: 'Você pode', paragraphs: ['Baixar e usar as imagens originais como papel de parede pessoal no computador, celular ou tablet. Pode recortá-las para caber na sua tela.'] },
      { heading: 'Não faça sem permissão', paragraphs: ['Vender, redistribuir ou publicar as imagens como pacote de papéis de parede; usá-las em publicidade, produtos ou outros trabalhos comerciais; ou afirmar que são suas. Para outros usos, escreva para wallpapers@want.foundation.'] },
      { heading: 'Direitos', paragraphs: ['Os direitos das imagens continuam com seu titular. Esta licença concede uso limitado, não propriedade.'] },
    ] },
    contact: { intro: 'Uma pergunta, ideia de licença ou detalhe que passou despercebido? Escreva para nós.', sections: [
      { heading: 'Email', paragraphs: ['wallpapers@want.foundation'] },
      { heading: 'Responsável', owner: true, paragraphs: [] },
    ] },
  },
};

export function legalPage(locale: Locale, key: LegalKey): Page {
  return { title: copy[locale][key], ...content[locale][key] };
}
