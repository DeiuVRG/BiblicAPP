import { screen } from '@testing-library/react-native';

import { loadBundledRepository } from '@/content/repository';
import { WorkScreen } from '@/features/work/work-screen';
import { createMemoryStore, renderWithProviders } from '@/test-support/render';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

describe('WorkScreen', () => {
  it('shows metadata, licence and the table of contents', async () => {
    const { repository } = await loadBundledRepository();
    const [work] = await repository.listWorks();
    const sections = await repository.getSections(work!.workId);
    await renderWithProviders(<WorkScreen workId={work!.workId} />);

    expect((await screen.findAllByText(work!.titleRo)).length).toBeGreaterThan(0);
    expect(screen.getByText('Cuprins')).toBeTruthy();
    expect(screen.getByText(/Licență: /)).toBeTruthy();
    expect(screen.getByLabelText(`Deschide ${sections[0]!.heading}`)).toBeTruthy();
    expect(screen.getByLabelText('Începe lectura')).toBeTruthy();
  });

  it('offers to continue where the reader stopped', async () => {
    const { repository } = await loadBundledRepository();
    const [work] = await repository.listWorks();
    const sections = await repository.getSections(work!.workId);
    const store = createMemoryStore({
      [`biblioteca:position:v1:${work!.workId}`]: JSON.stringify({
        sectionId: sections[1]!.id,
        paragraphId: null,
        updatedAt: 1,
      }),
    });
    await renderWithProviders(<WorkScreen workId={work!.workId} />, { store });

    expect(await screen.findByLabelText('Continuă lectura')).toBeTruthy();
    expect(screen.getByText(new RegExp(`${sections[1]!.heading}.*în curs`))).toBeTruthy();
  });

  it('reports an unknown work', async () => {
    await renderWithProviders(<WorkScreen workId="missing" />);
    expect(await screen.findByText('Lucrarea nu a fost găsită.')).toBeTruthy();
  });
});
