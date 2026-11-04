import { render, screen } from '@testing-library/react-native';

import { PlaceholderScreen } from '@/components/placeholder-screen';

describe('smoke', () => {
  it('renders a placeholder screen with a Romanian title', async () => {
    await render(<PlaceholderScreen title="Căutare" />);
    expect(screen.getByText('Căutare')).toBeTruthy();
    expect(screen.getByText('În lucru')).toBeTruthy();
  });
});
