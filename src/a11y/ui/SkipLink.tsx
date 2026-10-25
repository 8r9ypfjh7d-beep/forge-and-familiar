/** First tab stop on the page: jumps past the top bar to the main content. */
export function SkipLink({ target = 'main' }: { target?: string }) {
  return <a className="a11y-skip" href={`#${target}`}>Skip to main content</a>
}
