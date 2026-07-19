export function formatDestinationInput(value: string): string {
  return value.replace(/(^|[\s,('/-])([\p{Ll}])/gu, (_, prefix: string, letter: string) =>
    `${prefix}${letter.toLocaleUpperCase()}`,
  );
}
