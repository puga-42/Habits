import { render } from '@testing-library/react-native';

import { ThemedText } from '../themed-text';

describe('ThemedText', () => {
  it('does not apply a lineHeight for icon type', () => {
    const { getByText } = render(
      <ThemedText type="icon" style={{ fontSize: 40 }}>🧘</ThemedText>,
    );
    const node = getByText('🧘');
    const flatStyle = Array.isArray(node.props.style)
      ? Object.assign({}, ...node.props.style.filter(Boolean))
      : node.props.style;
    expect(flatStyle.lineHeight).toBeUndefined();
  });

  it('still applies lineHeight for default type', () => {
    const { getByText } = render(
      <ThemedText>Hello</ThemedText>,
    );
    const node = getByText('Hello');
    const flatStyle = Array.isArray(node.props.style)
      ? Object.assign({}, ...node.props.style.filter(Boolean))
      : node.props.style;
    expect(flatStyle.lineHeight).toBe(24);
  });

  it('display types set the rounded font family (Ember voice)', () => {
    // Titles, group names, stat values, and streak numbers use SF Pro Rounded
    // via Fonts.rounded — the friendly display voice of the Ember direction.
    for (const type of ['display', 'displaySemiBold'] as const) {
      const { getByText } = render(<ThemedText type={type}>Workout</ThemedText>);
      const node = getByText('Workout');
      const flatStyle = Array.isArray(node.props.style)
        ? Object.assign({}, ...node.props.style.filter(Boolean))
        : node.props.style;
      expect(flatStyle.fontFamily).toBeTruthy();
    }
  });
});
