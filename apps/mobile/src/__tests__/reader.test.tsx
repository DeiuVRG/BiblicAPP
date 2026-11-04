import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadBundledRepository } from '@/content/repository';
import { ReaderScreen } from '@/features/reader/reader-screen';
import { readHref } from '@/navigation-hrefs';
import { router } from '@/test-support/expo-router-mock';
import { createMemoryStore, renderWithProviders } from '@/test-support/render';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

async function firstSection() {
  const { repository } = await loadBundledRepository();
  const [work] = await repository.listWorks();
  const sections = await repository.getSections(work!.workId);
  const paragraphs = await repository.getParagraphs(sections[0]!.id);
  return { workId: work!.workId, sections, paragraphs };
}

describe('ReaderScreen', () => {
  beforeEach(() => {
    router.push.mockClear();
    router.replace.mockClear();
  });

  it('renders the heading and the paragraphs of the bundled pack, and records the position', async () => {
    const { workId, sections, paragraphs } = await firstSection();
    const store = createMemoryStore();
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={sections[0]!.id} />, {
      store,
    });

    expect(await screen.findByText(paragraphs[0]!.text)).toBeTruthy();
    expect(screen.getAllByRole('header').length).toBeGreaterThan(0);
    expect(screen.getByRole('progressbar')).toBeTruthy();

    await waitFor(() => {
      const saved = store.data.get(`biblioteca:position:v1:${workId}`);
      expect(saved).toBeDefined();
      expect(JSON.parse(saved!)).toMatchObject({ sectionId: sections[0]!.id });
    });
  });

  it('goes to the next chapter with the next button and disables previous on the first one', async () => {
    const { workId, sections, paragraphs } = await firstSection();
    expect(sections.length).toBeGreaterThan(1);
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={sections[0]!.id} />);
    await screen.findByText(paragraphs[0]!.text);

    expect(screen.getByLabelText('Capitolul anterior')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Capitolul următor'));
    expect(router.replace).toHaveBeenCalledWith(readHref(workId, sections[1]!.id));
  });

  it('shows a Romanian message for an unknown section', async () => {
    const { workId } = await firstSection();
    await renderWithProviders(<ReaderScreen workId={workId} sectionId="missing" />);
    expect(await screen.findByText('Secțiunea nu a fost găsită.')).toBeTruthy();
  });

  afterAll(async () => {
    await AsyncStorage.clear();
  });
});
