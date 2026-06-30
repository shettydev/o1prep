import { InterviewView } from "@/components/interview/InterviewView";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InterviewView problemId={Number(id)} />;
}
