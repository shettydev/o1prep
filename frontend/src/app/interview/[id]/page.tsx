import { ComingSoon } from "@/components/ComingSoon";

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ComingSoon module="interview" id={Number(id)} />;
}
