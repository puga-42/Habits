import { fireEvent, render } from '@testing-library/react-native';

import { AvatarViewerModal } from '../avatar-viewer-modal';

jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  const chain = () => new Proxy({}, { get: () => chain });
  return {
    Gesture: { Pinch: chain, Pan: chain, Tap: chain, Simultaneous: chain, Exclusive: chain },
    GestureDetector: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const Animated = { View, Image: View, createAnimatedComponent: (c: unknown) => c };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue: (v: number) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withTiming: (v: number) => v,
  };
});

describe('AvatarViewerModal', () => {
  it('does not render when visible is false', () => {
    const { queryByTestId } = render(
      <AvatarViewerModal visible={false} imageUri="https://example.com/a.jpg" handle="Alice" onClose={jest.fn()} />,
    );
    expect(queryByTestId('avatar-viewer-root')).toBeNull();
  });

  it('renders image when imageUri is provided', () => {
    const { getByTestId } = render(
      <AvatarViewerModal visible={true} imageUri="https://example.com/a.jpg" handle="Alice" onClose={jest.fn()} />,
    );
    expect(getByTestId('avatar-viewer-root')).toBeTruthy();
    expect(getByTestId('avatar-viewer-image')).toBeTruthy();
  });

  it('renders fallback initial when imageUri is null', () => {
    const { getByText, queryByTestId } = render(
      <AvatarViewerModal visible={true} imageUri={null} handle="Bob" onClose={jest.fn()} />,
    );
    expect(getByText('B')).toBeTruthy();
    expect(queryByTestId('avatar-viewer-image')).toBeNull();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <AvatarViewerModal visible={true} imageUri="https://example.com/a.jpg" handle="Alice" onClose={onClose} />,
    );
    fireEvent.press(getByTestId('avatar-viewer-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
