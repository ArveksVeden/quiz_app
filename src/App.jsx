import VPDQuiz from "./VPDQuiz";
import questions from "./vpd_quiz_ques.json";
import './index.css';

export default function App() {
  return <VPDQuiz questions={questions} limit={20} />;
}
