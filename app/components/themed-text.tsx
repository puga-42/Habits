import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTokens } from '@/hooks/use-tokens';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?:
    | 'default'
    | 'title'
    | 'defaultSemiBold'
    | 'subtitle'
    | 'link'
    | 'icon'
    | 'display'
    | 'displaySemiBold';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const tokens = useTokens();

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? [styles.link, { color: tokens.accent }] : undefined,
        type === 'display' ? styles.display : undefined,
        type === 'displaySemiBold' ? styles.displaySemiBold : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
  },
  // Ember display voice — SF Pro Rounded for the friendly surfaces: screen
  // titles, group names, stat values, streak numbers (see PLAN.md).
  display: {
    fontFamily: Fonts?.rounded,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  displaySemiBold: {
    fontFamily: Fonts?.rounded,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
  },
});
