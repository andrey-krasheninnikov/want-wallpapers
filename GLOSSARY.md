# Want Wallpapers glossary

One catalogue contains collections. Each collection contains wallpapers.

- **Collection**: a named group of related wallpapers with one stable slug and localized title and description.
- **Wallpaper**: one design with a stable ID, one collection, a category, tags, and localized title and description.
- **Variant**: the desktop or mobile PNG of a wallpaper. Both variants belong to the same wallpaper and share its rating and comments.
- **Preview**: a smaller WebP copy used on catalogue and detail pages.
- **Download**: the original PNG copied from the image host to site hosting so browsers can save it directly.
- **Rating**: one current reaction per wallpaper and anonymous visitor. The labels are Dislike (👎), Like (👍), Love it (💖), and Amazing (🚀), translated for each locale. Their stored values remain cringe, minus, plus, and imba respectively.
- **Comment**: public text tied to a wallpaper and an anonymous visitor. The account can delete its own comment.
- **Feedback**: a private message for the site owner. A closed message is deleted one year after closure by scheduled cleanup.

- **Archive**: hides a collection or wallpaper from the next public catalogue export while keeping its identity and social data.
- **Snapshot**: validated catalogue JSON used to build public pages and search.
- **Administrator**: the single account protected by password and TOTP; its session is separate from anonymous visitors.
