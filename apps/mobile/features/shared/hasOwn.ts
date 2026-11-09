/** Own-property check for runtimes without ES2022 Object.hasOwn; never trusts the object's prototype. */
export function hasOwn(object: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(object, key)
}
