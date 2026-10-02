import type { Locale } from './catalog';
import { copy } from './copy';

export type LegalKey = 'privacy' | 'terms' | 'cookies' | 'license' | 'contact';
type Section = { heading: string; paragraphs: string[] };
type Page = { title: string; intro: string; sections: Section[] };

const content: Record<Locale, Record<LegalKey, Omit<Page, 'title'>>> = {
  en: {
    privacy: { intro: 'This page explains what happens to your data when you browse, download or leave a note.', sections: [
      { heading: 'Who operates this site', paragraphs: ['Andrey Krasheninnikov, a Russian sole proprietor based in Georgia. Contact: wallpapers@want.foundation.'] },
      { heading: 'Data we use', paragraphs: ['Firebase Hosting and the image host receive technical request data, including your IP address. An external IP lookup receives your IP address to decide whether comments, ratings, feedback and analytics are available in your region. That check can be wrong.', 'If you rate or comment, Firebase creates an anonymous account in your browser and stores its identifier with your action. Feedback includes your topic, message and optional email. We do not ask for your name.', 'Analytics is disabled until you allow it in cookie settings. It stays disabled for Russian IP addresses and when the region check fails. No advertising network is connected at launch.'] },
      { heading: 'Storage and retention', paragraphs: ['Catalogue, ratings, comments and feedback are stored in Cloud Firestore in europe-west3. The site also uses Google Firebase, Timeweb S3 and an external IP lookup; their processing locations may differ.', 'You can delete your own comment in the same browser. We keep published comments and ratings until removal or a deletion request. Closed feedback entries are deleted after one year. Write to wallpapers@want.foundation to ask about or request deletion of your data.'] },
    ] },
    terms: { intro: 'Please use Want Wallpapers with care for the work and the people here.', sections: [
      { heading: 'The site', paragraphs: ['You may browse, search and download wallpapers for personal use under the license below. Availability and features can change. We cannot promise uninterrupted access.'] },
      { heading: 'Comments and feedback', paragraphs: ['Do not post unlawful, abusive, misleading or spam content, or someone else’s personal data. We may remove comments or restrict misuse. A report asks us to review a comment; it does not remove it automatically.'] },
      { heading: 'Operator', paragraphs: ['Andrey Krasheninnikov, a Russian sole proprietor based in Georgia. Questions: wallpapers@want.foundation.'] },
    ] },
    cookies: { intro: 'A small amount of browser storage makes this site work. Analytics is your choice.', sections: [
      { heading: 'Essential storage', paragraphs: ['Local storage keeps your cookie choice. Session storage keeps the result of the regional availability check. If you rate, comment or send feedback, Firebase Authentication stores an anonymous account on your device. These features need this storage.'] },
      { heading: 'Optional analytics', paragraphs: ['Firebase Analytics runs only after you choose “Allow analytics”, when it is configured and available in your region. Choose “Essential only” to decline. Open Cookie settings in the footer to change your choice at any time.'] },
      { heading: 'Advertising', paragraphs: ['No advertising service is connected at launch. This page will be updated before optional advertising storage is introduced.'] },
    ] },
    license: { intro: 'The wallpapers are free to keep on your own screens.', sections: [
      { heading: 'You may', paragraphs: ['Download and use the original images as personal wallpapers on your devices, including a personal computer, phone or tablet. You may crop them for your own screen.'] },
      { heading: 'Please do not', paragraphs: ['Sell, redistribute or upload the images as a wallpaper pack; use them in advertising, products or other commercial work; or claim them as your own work. Ask wallpapers@want.foundation for any use beyond personal, noncommercial display.'] },
      { heading: 'Ownership', paragraphs: ['The images remain the property of their rights holder. This license grants limited use, not ownership.'] },
    ] },
    contact: { intro: 'A question, a licensing idea or a small detail we missed? Write to us.', sections: [
      { heading: 'Email', paragraphs: ['wallpapers@want.foundation'] },
      { heading: 'Operator', paragraphs: ['Andrey Krasheninnikov, a Russian sole proprietor based in Georgia.'] },
    ] },
  },
  ru: {
    privacy: { intro: 'Здесь рассказываем, что происходит с данными при просмотре, скачивании и общении на сайте.', sections: [
      { heading: 'Кто управляет сайтом', paragraphs: ['ИП Андрей Крашенинников (Россия), находится в Грузии. Контакт: wallpapers@want.foundation.'] },
      { heading: 'Какие данные используются', paragraphs: ['Firebase Hosting и хранилище изображений получают технические данные запроса, включая IP-адрес. Внешний сервис проверки страны получает IP-адрес, чтобы определить доступность комментариев, оценок, формы и аналитики. Проверка может ошибаться.', 'При оценке или комментарии Firebase создаёт анонимную учётную запись в браузере и сохраняет её идентификатор вместе с действием. В форме обратной связи передаются тема, сообщение и необязательный email. Имя мы не запрашиваем.', 'Аналитика выключена до согласия в настройках cookie. Для российских IP-адресов и при ошибке проверки страны она остаётся выключенной. На момент запуска рекламная сеть не подключена.'] },
      { heading: 'Хранение и удаление', paragraphs: ['Каталог, оценки, комментарии и обращения хранятся в Cloud Firestore в регионе europe-west3. Также используются Google Firebase, Timeweb S3 и внешний сервис проверки IP; их места обработки данных могут отличаться.', 'Вы можете удалить свой комментарий в том же браузере. Опубликованные комментарии и оценки хранятся до удаления или запроса на удаление. Закрытые обращения удаляются через год. По вопросам данных и удаления пишите на wallpapers@want.foundation.'] },
    ] },
    terms: { intro: 'Пожалуйста, относитесь бережно к работам и людям на сайте.', sections: [
      { heading: 'Сайт', paragraphs: ['Можно просматривать, искать и скачивать обои для личного использования по лицензии ниже. Доступность сайта и функций может меняться; бесперебойная работа не гарантируется.'] },
      { heading: 'Комментарии и сообщения', paragraphs: ['Не публикуйте незаконные, оскорбительные, вводящие в заблуждение или рекламные сообщения и чужие персональные данные. Мы можем удалять комментарии и ограничивать злоупотребления. Жалоба отправляет комментарий на проверку, но не удаляет его автоматически.'] },
      { heading: 'Владелец', paragraphs: ['ИП Андрей Крашенинников (Россия), находится в Грузии. Вопросы: wallpapers@want.foundation.'] },
    ] },
    cookies: { intro: 'Небольшой объём данных в браузере нужен для работы сайта. Аналитика остаётся вашим выбором.', sections: [
      { heading: 'Необходимое хранение', paragraphs: ['Локальное хранилище запоминает выбор cookie. Хранилище сеанса сохраняет результат проверки доступности функций по стране. Для оценок, комментариев и формы Firebase Authentication хранит на устройстве анонимную учётную запись. Без неё эти функции не работают.'] },
      { heading: 'Необязательная аналитика', paragraphs: ['Firebase Analytics включается только после выбора «Разрешить аналитику», если она настроена и доступна в вашем регионе. Выбор «Только необходимые» отключает её. Изменить решение можно через «Настройки cookie» внизу страницы.'] },
      { heading: 'Реклама', paragraphs: ['На момент запуска рекламная сеть не подключена. Перед добавлением необязательного рекламного хранения эта страница будет обновлена.'] },
    ] },
    license: { intro: 'Обои можно бесплатно оставить на своих экранах.', sections: [
      { heading: 'Можно', paragraphs: ['Скачивать и использовать оригинальные изображения как личные обои на компьютере, телефоне или планшете. Можно обрезать их под свой экран.'] },
      { heading: 'Нельзя без разрешения', paragraphs: ['Продавать, распространять или загружать изображения как набор обоев; использовать их в рекламе, продуктах и другой коммерческой работе; выдавать за свои. Для другого использования напишите на wallpapers@want.foundation.'] },
      { heading: 'Права', paragraphs: ['Права на изображения остаются у правообладателя. Эта лицензия даёт ограниченное право использования, а не право собственности.'] },
    ] },
    contact: { intro: 'Вопрос, идея по лицензии или замеченная мелочь? Напишите нам.', sections: [
      { heading: 'Email', paragraphs: ['wallpapers@want.foundation'] },
      { heading: 'Владелец', paragraphs: ['ИП Андрей Крашенинников (Россия), находится в Грузии.'] },
    ] },
  },
  'zh-cn': {
    privacy: { intro: '本页说明你浏览、下载或留言时，我们如何处理数据。', sections: [
      { heading: '网站运营者', paragraphs: ['Andrey Krasheninnikov，俄罗斯个体经营者，现居格鲁吉亚。联系邮箱：wallpapers@want.foundation。'] },
      { heading: '使用的数据', paragraphs: ['Firebase Hosting 和图片存储服务会收到包含 IP 地址在内的技术请求数据。外部 IP 查询服务会收到 IP 地址，以判断你所在地区是否提供评论、评分、反馈和分析功能；该判断可能出错。', '评分或评论时，Firebase 会在浏览器中创建匿名账户，并将其标识符与操作一起保存。反馈表单收集主题、留言和可选邮箱；我们不要求姓名。', '只有你在 Cookie 设置中同意后，才会启用分析。俄罗斯 IP 地址或地区检查失败时，分析保持关闭。上线时没有接入广告网络。'] },
      { heading: '存储与删除', paragraphs: ['目录、评分、评论和反馈存储在 europe-west3 区域的 Cloud Firestore。网站还使用 Google Firebase、Timeweb S3 和外部 IP 查询服务，处理地点可能不同。', '你可在同一浏览器中删除自己的评论。评论和评分保留至删除或收到删除请求。已处理完的反馈在一年后删除。如需查询或删除数据，请联系 wallpapers@want.foundation。'] },
    ] },
    terms: { intro: '请尊重作品和这里的其他人。', sections: [
      { heading: '网站使用', paragraphs: ['你可根据下方许可浏览、搜索和下载壁纸供个人使用。网站和功能可能调整，无法保证持续可用。'] },
      { heading: '评论与反馈', paragraphs: ['请勿发布违法、辱骂、误导或垃圾内容，也不要发布他人的个人信息。我们可能删除评论或限制滥用。举报会提交审核，不会自动删除评论。'] },
      { heading: '运营者', paragraphs: ['Andrey Krasheninnikov，俄罗斯个体经营者，现居格鲁吉亚。邮箱：wallpapers@want.foundation。'] },
    ] },
    cookies: { intro: '少量浏览器存储用于网站运行。是否启用分析由你决定。', sections: [
      { heading: '必要存储', paragraphs: ['本地存储保存 Cookie 选择；会话存储保存地区功能检查结果。评分、评论或发送反馈时，Firebase Authentication 会在设备上保存匿名账户。相关功能需要这些存储。'] },
      { heading: '可选分析', paragraphs: ['只有选择“允许分析”、已配置分析且所在地区可用时，才会运行 Firebase Analytics。选择“仅必要项”即可拒绝。你可以随时通过页脚的 Cookie 设置更改选择。'] },
      { heading: '广告', paragraphs: ['网站上线时未接入广告服务。引入可选广告存储前，我们会更新本页。'] },
    ] },
    license: { intro: '你可以免费将这些壁纸留在自己的屏幕上。', sections: [
      { heading: '允许的使用', paragraphs: ['下载原图并用于个人电脑、手机或平板的壁纸。你也可以为适配自己的屏幕裁剪图片。'] },
      { heading: '未经许可请勿', paragraphs: ['出售、重新分发或作为壁纸包上传图片；将其用于广告、产品或其他商业项目；声称作品由自己创作。其他用途请联系 wallpapers@want.foundation。'] },
      { heading: '权利归属', paragraphs: ['图片权利仍属于权利人。此许可只授予有限使用权，不转移所有权。'] },
    ] },
    contact: { intro: '有问题、许可合作想法，或发现了一个小细节？欢迎来信。', sections: [
      { heading: '邮箱', paragraphs: ['wallpapers@want.foundation'] },
      { heading: '运营者', paragraphs: ['Andrey Krasheninnikov，俄罗斯个体经营者，现居格鲁吉亚。'] },
    ] },
  },
  'pt-br': {
    privacy: { intro: 'Esta página explica o que acontece com seus dados ao navegar, baixar ou enviar uma mensagem.', sections: [
      { heading: 'Responsável pelo site', paragraphs: ['Andrey Krasheninnikov, empresário individual russo residente na Geórgia. Contato: wallpapers@want.foundation.'] },
      { heading: 'Dados utilizados', paragraphs: ['Firebase Hosting e o armazenamento de imagens recebem dados técnicos da requisição, incluindo o IP. Um serviço externo de consulta de IP recebe seu endereço para verificar a disponibilidade de comentários, avaliações, contato e análise na sua região. A verificação pode falhar.', 'Ao avaliar ou comentar, o Firebase cria uma conta anônima no navegador e guarda seu identificador com a ação. O formulário recebe assunto, mensagem e email opcional. Não pedimos seu nome.', 'A análise fica desativada até sua autorização nas configurações de cookies. Também fica desativada para IPs russos ou se a verificação regional falhar. Nenhuma rede de anúncios está conectada no lançamento.'] },
      { heading: 'Armazenamento e exclusão', paragraphs: ['Catálogo, avaliações, comentários e mensagens ficam no Cloud Firestore na região europe-west3. O site também usa Google Firebase, Timeweb S3 e um serviço externo de consulta de IP; os locais de processamento podem ser diferentes.', 'Você pode excluir seu comentário no mesmo navegador. Comentários e avaliações permanecem até a remoção ou solicitação de exclusão. Mensagens encerradas são excluídas após um ano. Para consultar ou pedir a exclusão de dados, escreva para wallpapers@want.foundation.'] },
    ] },
    terms: { intro: 'Use o Want Wallpapers com respeito pelas obras e pelas pessoas.', sections: [
      { heading: 'O site', paragraphs: ['Você pode navegar, buscar e baixar papéis de parede para uso pessoal conforme a licença abaixo. A disponibilidade e as funções podem mudar; não garantimos acesso ininterrupto.'] },
      { heading: 'Comentários e mensagens', paragraphs: ['Não publique conteúdo ilegal, ofensivo, enganoso ou spam, nem dados pessoais de terceiros. Podemos remover comentários ou limitar abusos. Uma denúncia solicita análise; não remove o comentário automaticamente.'] },
      { heading: 'Responsável', paragraphs: ['Andrey Krasheninnikov, empresário individual russo residente na Geórgia. Contato: wallpapers@want.foundation.'] },
    ] },
    cookies: { intro: 'Uma pequena quantidade de armazenamento no navegador faz o site funcionar. A análise é sua escolha.', sections: [
      { heading: 'Armazenamento essencial', paragraphs: ['O armazenamento local guarda sua escolha de cookies. O armazenamento de sessão guarda o resultado da verificação regional. Ao avaliar, comentar ou enviar contato, o Firebase Authentication salva uma conta anônima no dispositivo. Essas funções precisam desse armazenamento.'] },
      { heading: 'Análise opcional', paragraphs: ['O Firebase Analytics só funciona após escolher “Permitir análise”, quando estiver configurado e disponível na sua região. Escolha “Só essenciais” para recusar. Você pode mudar a decisão em Configurações de cookies no rodapé.'] },
      { heading: 'Publicidade', paragraphs: ['Nenhum serviço de anúncios está conectado no lançamento. Esta página será atualizada antes da inclusão de armazenamento publicitário opcional.'] },
    ] },
    license: { intro: 'Os papéis de parede são gratuitos para suas próprias telas.', sections: [
      { heading: 'Você pode', paragraphs: ['Baixar e usar as imagens originais como papel de parede pessoal no computador, celular ou tablet. Pode recortá-las para caber na sua tela.'] },
      { heading: 'Não faça sem permissão', paragraphs: ['Vender, redistribuir ou publicar as imagens como pacote de papéis de parede; usá-las em publicidade, produtos ou outros trabalhos comerciais; ou afirmar que são suas. Para outros usos, escreva para wallpapers@want.foundation.'] },
      { heading: 'Direitos', paragraphs: ['Os direitos das imagens continuam com seu titular. Esta licença concede uso limitado, não propriedade.'] },
    ] },
    contact: { intro: 'Uma pergunta, ideia de licença ou detalhe que passou despercebido? Escreva para nós.', sections: [
      { heading: 'Email', paragraphs: ['wallpapers@want.foundation'] },
      { heading: 'Responsável', paragraphs: ['Andrey Krasheninnikov, empresário individual russo residente na Geórgia.'] },
    ] },
  },
};

export function legalPage(locale: Locale, key: LegalKey): Page {
  return { title: copy[locale][key], ...content[locale][key] };
}
