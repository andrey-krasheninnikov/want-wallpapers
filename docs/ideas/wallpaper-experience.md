# Wallpaper browsing and download experience

Visitors choose a desktop or phone background, inspect the image and download the PNG. The wallpaper carries the page; controls stay together, and discussion follows below.

The composition uses a fixed-size image frame on the left and a glass control panel on the right from 1024 px. On smaller screens they stack. Desktop and Mobile use the same frame with their full image contained inside. Navigation stays below the frame. Download is a native same-origin download link; compact ratings follow. The latest ten comments appear in horizontal cards before collection context and long reading.

Neutral graphite surfaces retain the existing logo and its #5B4FFF accent. Glass belongs to navigation and controls. Long reading stays opaque and flows through up to three columns. Home collections use a finite horizontal carousel; selected wallpapers form an asymmetric mosaic. Stories expand on request.

Feedback opens on the current page and preserves the draft while closed. Direct feedback routes remain available. Search and neighboring wallpapers use immutable publication chronology, including additions to older collections.

A moving logo-color glow, stronger text sparkles and download confetti respect accessibility preferences and remain bounded. The local 3D scene loads automatically, rotates slowly and supports pause, manual control and poster fallback. Manual rotation picks another work and changes both screen textures together. Automatic rotation and Reset keep the selected work. Wallpaper routes update through Astro ClientRouter, preserving viewer position and history. The home bubble grid fills a rectangular composition with soft corners.

Acceptance includes four locales, 320 px layouts, 200% text scaling, keyboard operation, reduced motion, request failure/retry and native navigation/downloads. No new dependencies, fonts, logo shape, theme switch or production deployment are required. PR #63 remains open for visual review.
