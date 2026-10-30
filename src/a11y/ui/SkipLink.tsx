import { useI18n } from '../../i18n'

/** First tab stop on the page: jumps past the top bar to the main content. */
export function SkipLink({ target = 'main' }: { target?: string }) {
  const { t } = useI18n()
  return <a className="a11y-skip" href={`#${target}`}>{t('a11y.skip')}</a>
}
