import { Check, ChevronDown, Monitor, Moon, Sun } from 'lucide-react';
import {
  Dropdown,
  DropdownItem,
  DropdownSection,
} from '@/components/ui/Dropdown';
import { usePrefsStore, type Currency, type ThemeChoice } from '@/store/usePrefsStore';

const CURRENCIES: Array<{ value: Currency; symbol: string; name: string }> = [
  { value: 'USD', symbol: '$', name: 'US Dollar' },
  { value: 'EUR', symbol: '€', name: 'Euro' },
  { value: 'GBP', symbol: '£', name: 'Pound Sterling' },
  { value: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
];

const THEMES: Array<{ value: ThemeChoice; name: string; Icon: typeof Sun }> = [
  { value: 'light', name: 'Light', Icon: Sun },
  { value: 'system', name: 'Match system', Icon: Monitor },
  { value: 'dark', name: 'Dark', Icon: Moon },
];

/**
 * Currency and theme, in one menu.
 *
 * These used to be two side-by-side segmented controls: four currency slots
 * plus three theme slots, seven tap targets competing with the search field
 * for the width of a phone. The theme control lost that fight and was hidden
 * below the `sm` breakpoint entirely — which meant a phone had no way to
 * switch between light and dark at all.
 *
 * One trigger, two sections. It costs a tap on desktop and buys back the whole
 * control on mobile.
 */
export function DisplayMenu() {
  const currency = usePrefsStore((s) => s.currency);
  const setCurrency = usePrefsStore((s) => s.setCurrency);
  const theme = usePrefsStore((s) => s.theme);
  const setTheme = usePrefsStore((s) => s.setTheme);

  const active = CURRENCIES.find((c) => c.value === currency) ?? CURRENCIES[0];
  const ActiveThemeIcon = (THEMES.find((t) => t.value === theme) ?? THEMES[1]).Icon;

  return (
    <Dropdown
      label="Currency and appearance"
      trigger={
        <>
          <span className="text-sm font-semibold">{active.symbol}</span>
          <ActiveThemeIcon className="h-3.5 w-3.5" />
          <ChevronDown className="h-3 w-3 text-ink-dim" />
        </>
      }
    >
      {(close) => (
        <>
          <DropdownSection title="Currency">
            {CURRENCIES.map((option) => (
              <DropdownItem
                key={option.value}
                selected={option.value === currency}
                onSelect={() => {
                  setCurrency(option.value);
                  close();
                }}
              >
                <span className="w-4 text-center font-semibold">{option.symbol}</span>
                <span className="flex-1">{option.name}</span>
                {option.value === currency && <Check className="h-3.5 w-3.5" />}
              </DropdownItem>
            ))}
          </DropdownSection>

          <DropdownSection title="Appearance">
            {THEMES.map(({ value, name, Icon }) => (
              <DropdownItem
                key={value}
                selected={value === theme}
                onSelect={() => {
                  setTheme(value);
                  close();
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="flex-1">{name}</span>
                {value === theme && <Check className="h-3.5 w-3.5" />}
              </DropdownItem>
            ))}
          </DropdownSection>
        </>
      )}
    </Dropdown>
  );
}
