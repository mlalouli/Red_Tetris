import { routeFromPath } from '../src/client/route';

test.each([
  ['/arena', { solo: false, room: 'arena', name: 'player' }],
  ['/arena/Ada', { solo: false, room: 'arena', name: 'Ada' }],
  ['/arena/Meryem', { solo: false, room: 'arena', name: 'Meryem' }],
  ['/arena/Ahmed', { solo: false, room: 'arena', name: 'Ahmed' }]
])('parses room and player segments from %s', (pathname, expected) => {
  expect(routeFromPath(pathname)).toEqual(expected);
});

test('decodes URL-encoded player names', () => {
  expect(routeFromPath('/arena/Ada%20Lovelace')).toEqual({ solo: false, room: 'arena', name: 'Ada Lovelace' });
});
