import { expect, test } from 'bun:test';

for (const timezone of ['UTC', 'America/Los_Angeles']) {
  test(`comment dates stay stable during SSR in ${timezone}`, () => {
    const result = Bun.spawnSync([process.execPath, '-e', `
      import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import CommentFeed from './src/components/CommentFeed';
      console.log(renderToStaticMarkup(React.createElement(CommentFeed, {
        locale: 'en', comments: [{ id: 'example', uid: 'visitor', text: 'A clear horizon.', createdAt: Date.parse('2026-10-28T00:15:00Z') }],
        ownUid: 'visitor', reported: [], busy: false, onAction: () => {}
      })));
    `], { cwd: import.meta.dirname + '/..', env: { ...process.env, TZ: timezone } });
    expect(result.exitCode).toBe(0);
    const html = new TextDecoder().decode(result.stdout);
    expect(html.match(/<time[^>]*>([^<]+)<\/time>/)?.[1]).toBe('10/28/2026');
  });
}
