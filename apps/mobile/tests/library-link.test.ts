import { isLibraryLink, libraryLinkPath, libraryLinkUrl, readLibraryId } from '../features/links/libraryLink'
const url = 'https://web.tarkman.app/liturgies/'
it.each([1, Number.MAX_SAFE_INTEGER])('builds canonical id %s', id => {
  expect(libraryLinkUrl(id)).toBe(`${url}${id}`)
  expect(isLibraryLink(`${url}${id}`)).toBe(true)
})
it.each([0, -1, 1.5, NaN, 2 ** 53])('refuses id %s', id => expect(libraryLinkUrl(id)).toBeNull())
it.each(['http://web.tarkman.app/liturgies/1', 'https://www.tarkman.app/liturgies/1', 'https://web.tarkman.app:443/liturgies/1', 'https://u@web.tarkman.app/liturgies/1', 'https://WEB.tarkman.app/liturgies/1', ...['1?', '1#', '1?environment=x', '1/', '01', '0', '-1', '1.0', '1e2', '0x1', '%31', '9007199254740993', '1 ', '1\n', '1\\'].map(id => url + id), 'https://web.tarkman.app/sessions/display?token=x', 'tarkman://liturgies/1'])('rejects noncanonical %s', value => expect(isLibraryLink(value)).toBe(false))
it('reads canonical route ids only', () => {
  expect(readLibraryId('7')).toBe(7)
  for (const value of [undefined, ['7'], '', '007', '1e2', '0x10', '+5', '1.0', ' 1', '9007199254740993']) expect(readLibraryId(value)).toBeNaN()
})
it.each(['/liturgies/7', 'https://other.example/liturgies/7', 'https://web.tarkman.app/sessions/7/parts', 'tarkman://liturgies/7', 'https://web.tarkman.app:444/liturgies/7'])('leaves unrelated %s alone', value => expect(libraryLinkPath(value)).toBeUndefined())
it.each(['7', '7/', '7?environment=x&id=9&origin=library#f'])('normalizes %s', value => expect(libraryLinkPath(url + value)).toBe('/liturgies/7'))
it.each(['http://web.tarkman.app/liturgies/7', 'https://u@web.tarkman.app/liturgies/7', 'https://web.tarkman.app/liturgies', ...['', '0', '7/x', '%31', '9007199254740993'].map(id => url + id)])('blocks malformed %s', value => expect(libraryLinkPath(value)).toBe('/'))
