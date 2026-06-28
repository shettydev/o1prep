import { ComingSoon } from "@/components/ComingSoon";

export default async function StudyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ComingSoon module="study" id={Number(id)} />;
}
