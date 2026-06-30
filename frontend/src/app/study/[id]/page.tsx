import { StudyView } from "@/components/study/StudyView";

export default async function StudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudyView problemId={Number(id)} />;
}
