export function mapPalette() {
  const styles = getComputedStyle(document.documentElement);
  const color = (name: string, fallback: string) =>
    styles.getPropertyValue('--color-' + name).trim() || fallback;
  return {
    primary: color('primary', '#0058bc'),
    secondary: color('status-routing', '#5856D6'),
    teal: color('tint-teal', '#30B0C7'),
    orange: color('status-in-transit', '#FF9500'),
    outline: color('outline', '#717786'),
  };
}
