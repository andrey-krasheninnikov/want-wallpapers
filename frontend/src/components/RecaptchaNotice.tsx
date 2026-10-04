import { copy } from '@/data/copy';
import type { Locale } from '@/data/catalog';
export default function RecaptchaNotice({ locale }: { locale: Locale }) {
  const ui = copy[locale];
  return <p className="text-sm leading-relaxed text-muted-foreground">{ui.recaptchaNotice}{' '}<a className="text-link underline" href="https://policies.google.com/privacy">{ui.googlePrivacy}</a>{' '}{ui.recaptchaAnd}{' '}<a className="text-link underline" href="https://policies.google.com/terms">{ui.googleTerms}</a>{' '}{ui.recaptchaApplies}</p>;
}
