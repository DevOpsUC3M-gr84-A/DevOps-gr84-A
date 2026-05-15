export const isPaddingDescriptor = (s: string): boolean =>
  /^keyword\d+$/i.test(s.trim());

export const filterPaddingDescriptors = (descriptors: string[]): string[] =>
  descriptors.filter((d) => !isPaddingDescriptor(d));
