import { useApp } from '../app/AppContext.tsx';
import type { Screen } from '../app/screens.ts';
import { GuideContent } from '../components/GuideContent.tsx';
import { t } from '../i18n/index.ts';
import { ScreenFrame } from './ScreenFrame.tsx';

export function GuideScreen({ back }: { back?: Screen }) {
  const { navigate } = useApp();
  return (
    <ScreenFrame title={t('guide.title')} onBack={() => navigate(back ?? { name: 'start' })} testId="guide-screen" wide>
      <div className="scr-panel scr-panel--light">
        <GuideContent headingLevel={2} />
      </div>
    </ScreenFrame>
  );
}
