import { render } from '@testing-library/react-native';

import { FeedAvatar } from '../feed-avatar';

describe('FeedAvatar', () => {
  it('renders fallback initial without a constraining lineHeight', () => {
    const { getByText } = render(
      <FeedAvatar url={null} handle="Alice" size={96} />,
    );
    const node = getByText('A');
    const flatStyle = Array.isArray(node.props.style)
      ? Object.assign({}, ...node.props.style.filter(Boolean))
      : node.props.style;
    expect(flatStyle.lineHeight).toBeUndefined();
  });
});
