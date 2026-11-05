import { ComingScreen } from '@/components/coming-screen';

// The author page is P1b (docs/roadmap-v2.md, 3.5); until then a name leads to the library
// filtered by it, and this route says so instead of being "not found".
export default function AuthorRoute() {
  return <ComingScreen label="authors" />;
}
