import { InterviewView } from "@/components/interview/InterviewView";

export default async function ResumeInterviewPage({
  params,
}: {
  params: Promise<{ sid: string }>;
}) {
  const { sid } = await params;
  return <InterviewView sessionId={sid} />;
}
