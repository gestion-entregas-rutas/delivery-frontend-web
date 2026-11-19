export function mapPalette() {
  const styles = getComputedStyle(document.documentElement);
  const color = (name: string, fallback: string) =>
    styles.getPropertyValue('--color-' + name).trim() || fallback;
  return {
    primary: color('primary', '#6A1B9A'),
    secondary: color('status-routing', '#7E23DF'),
    teal: color('tint-teal', '#30B0C7'),
    orange: color('status-in-transit', '#B26A00'),
    outline: color('outline', '#717786'),
  };
}
