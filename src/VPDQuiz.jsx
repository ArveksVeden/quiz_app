import { useState, useEffect, useRef, useMemo } from "react";

// Fisher-Yates shuffle
    function shuffleArray(array) {
      const arr = array.slice();
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    function shuffleQuestionOptions(question) {
      // Для одного ответа
      if (Array.isArray(question.answers)) {
        // Несколько правильных ответов (мультиселект)
        const indices = question.options.map((_, idx) => idx);
        const shuffledIndices = shuffleArray(indices);

        // Сопоставляем новые опции
        const newOptions = shuffledIndices.map(idx => question.options[idx]);
        // Новые индексы правильных ответов
        const newAnswers = question.answers.map(
          ansIdx => shuffledIndices.indexOf(ansIdx)
        );
        return {
          ...question,
          options: newOptions,
          answers: newAnswers
        };
      } else {
        // Обычный вопрос с одним правильным ответом
        const indices = question.options.map((_, idx) => idx);
        const shuffledIndices = shuffleArray(indices);

        const newOptions = shuffledIndices.map(idx => question.options[idx]);
        const newAnswer = shuffledIndices.indexOf(question.answer);

        return {
          ...question,
          options: newOptions,
          answer: newAnswer
        };
      }
    }

export default function VPDQuiz({ questions }) {
  const [quiz, setQuiz] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState([]);
  const [isCorrect, setIsCorrect] = useState(null);
  const [errors, setErrors] = useState(0);
  const [wrongQuestions, setWrongQuestions] = useState([]);
  const [wrongCounts, setWrongCounts] = useState({});
  const [completed, setCompleted] = useState(false);
  const [replayWrong, setReplayWrong] = useState(false);
  const [limit, setLimit] = useState(null);
  const [mode, setMode] = useState("menu");
  const [noDifficult, setNoDifficult] = useState(false);
  const [attempts, setAttempts] = useState([]);
  const [wrongCountsLoaded, setWrongCountsLoaded] = useState(false);
  const [learnProgress, setLearnProgress] = useState({});
  const [learnIndex, setLearnIndex] = useState(0);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [blockSize, setBlockSize] = useState(10); // размер блока
  const [selectedBlock, setSelectedBlock] = useState(null); // индекс выбранного блока
  const [menuIndex, setMenuIndex] = useState(0);


    
    // 1. Основная логика загрузки вопросов по режимам
    useEffect(() => {
      // Добавляем id каждому вопросу (один раз)
      if (questions.length && questions[0].id === undefined) {
        questions.forEach((q, idx) => q.id = idx);
      }

      // Используем перемешанные вопросы!
      if (limit !== null && mode === "quiz") {
        const shuffled = [...questions].sort(() => 0.5 - Math.random());
        // Перемешайте опции каждого вопроса
        const randomized = shuffled.slice(0, limit).map(q => shuffleQuestionOptions(q));
        setQuiz(randomized);
        setCurrent(0);
        setSelected([]);
        setIsCorrect(null);
        setCompleted(false);
      }

      if (mode === "difficult" && wrongCountsLoaded) {
        const hardest = questions.filter((q) => wrongCounts[q.id] >= 1);
        if (hardest.length === 0) {
          setNoDifficult(true);
          setQuiz([]);
        } else {
          const shuffled = [...hardest].sort(() => 0.5 - Math.random());
          const randomized = shuffled.map(q => shuffleQuestionOptions(q));
          setQuiz(randomized);
          setCurrent(0);
          setSelected([]);
          setIsCorrect(null);
          setNoDifficult(false);
        }
      }

      if (mode === "final") {
        // Тут тоже надо перемешать options у каждого вопроса
        const randomized = questions.map(q => shuffleQuestionOptions(q));
        setQuiz(randomized); // без перемешивания массива вопросов, только options
        setCurrent(0);
        setSelected([]);
        setIsCorrect(null);
        setCompleted(false);
      }
    }, [limit, mode, questions, wrongCountsLoaded]);


    // 3. Загрузка wrongCounts из localStorage при старте
    useEffect(() => {
      const saved = localStorage.getItem("quizWrongCounts");
      if (saved) {
        try {
          setWrongCounts(JSON.parse(saved));
        } catch (e) {
          console.error("Ошибка при чтении wrongCounts из localStorage:", e);
        }
      }
      setWrongCountsLoaded(true);
    }, []);

    // 4. Сохранение wrongCounts в localStorage при каждом изменении
    useEffect(() => {
      localStorage.setItem("quizWrongCounts", JSON.stringify(wrongCounts));
    }, [wrongCounts]);

    // 5. Загрузка learnProgress из localStorage при старте
    useEffect(() => {
      const saved = localStorage.getItem("quizLearnProgress");
      if (saved) {
        try {
          setLearnProgress(JSON.parse(saved));
        } catch (e) {
          console.error("Ошибка при чтении quizLearnProgress:", e);
        }
      }
    }, []);

    // 6. Сохранение learnProgress в localStorage при каждом изменении
    useEffect(() => {
      localStorage.setItem("quizLearnProgress", JSON.stringify(learnProgress));
    }, [learnProgress]);

   useEffect(() => {
    if (mode === "learn" && selectedBlock !== null) {
      setLearnIndex(0);
      setSelected([]);
      setIsCorrect(null);
      setCompleted(false);
      setAnswerSubmitted(false);
    }
  }, [mode, selectedBlock]);

  useEffect(() => {
    function handleKeyDown(e) {
      // Меню
      if (mode === "menu") {
        if (e.key === "ArrowDown") {
          setMenuIndex(idx => (idx + 1) % menuOptions.length);
          e.preventDefault();
        }
        if (e.key === "ArrowUp") {
          setMenuIndex(idx => (idx - 1 + menuOptions.length) % menuOptions.length);
          e.preventDefault();
        }
        if (e.key === "Enter") {
          menuOptions[menuIndex].onClick();
          e.preventDefault();
        }
        return;
      }
      // Вопросы
      if (
        (mode === "learn" && selectedBlock === null) ||
        completed ||
        noDifficult
      ) {
        return;
      }

      if (["quiz", "final", "difficult", "learn"].includes(mode) && !answerSubmitted && q) {
        if (e.key === "ArrowDown") {
          setSelected(prev => {
            let idx = prev.length ? prev[prev.length - 1] : 0;
            idx = (idx + 1) % q.options.length;
            return [idx];
          });
          e.preventDefault();
        }
        if (e.key === "ArrowUp") {
          setSelected(prev => {
            let idx = prev.length ? prev[prev.length - 1] : 0;
            idx = (idx - 1 + q.options.length) % q.options.length;
            return [idx];
          });
          e.preventDefault();
        }
        if (e.key === "Enter" && selected.length > 0) {
          submitAnswer();
          e.preventDefault();
        }
      }

      if (
        (e.key === "ArrowRight" || e.key.toLowerCase() === "d" || e.key === "Enter") &&
        answerSubmitted
      ) {
        next();
        e.preventDefault();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    answerSubmitted,
    selected,
    mode,
    selectedBlock,
    completed,
    noDifficult,
    menuIndex,
    menuOptions,
    q
  ]);



  function splitIntoBlocks(arr, size) {
    const res = [];
    for (let i = 0; i < arr.length; i += size) {
      res.push(arr.slice(i, i + size));
    }
    return res;
  }
  const blocks = splitIntoBlocks(questions, blockSize);

  // 👇 Вот это - новый вариант learnBlock (с useMemo)!
  const learnBlock = useMemo(() => {
    if (mode === "learn" && selectedBlock !== null) {
      // Для выбранного блока — перемешиваем варианты в каждом вопросе
      return blocks[selectedBlock].map(q => shuffleQuestionOptions(q));
    }
    return [];
  // eslint-disable-next-line
  }, [mode, selectedBlock, blockSize, questions]);

  const q = mode === "learn" ? learnBlock[learnIndex] : quiz[current]; // <-- ВОТ ЗДЕСЬ!

  const isMultiple = (q) => Array.isArray(q.answers);

  const handleAnswer = (index) => {
    if (answerSubmitted) return; // блокируем выбор после проверки

    if (isMultiple(q)) {
      setSelected((prev) =>
        prev.includes(index)
          ? prev.filter((i) => i !== index)
          : [...prev, index]
      );
    } else {
      setSelected([index]);
    }
  };


  const submitAnswer = () => {
    const correct = isMultiple(q)
      ? arraysEqualIgnoreOrder(selected, q.answers)
      : selected[0] === q.answer;

    setIsCorrect(correct);
    if (mode === "learn" && q) {
      setLearnProgress(prev => {
        const current = prev[q.id]?.streak || 0;
        const updatedStreak = correct ? current + 1 : 0;
        return {
          ...prev,
          [q.id]: { streak: updatedStreak }
        };
      });
    }

    if (!correct) {
      const qid = q.id;
      setErrors((e) => e + 1);
      setWrongQuestions((prev) => [...prev, q]);
      setWrongCounts((prev) => ({ ...prev, [qid]: (prev[qid] || 0) + 1 }));
    }

    setAnswerSubmitted(true);
  };

  const next = () => {
  if (mode === "learn") {
    if (!isCorrect) {
      setAnswerSubmitted(false);
      setSelected([]);
      setIsCorrect(null);
      return;
    }
    // При верном — идём дальше
    if (learnIndex + 1 < learnBlock.length) {
      setLearnIndex(learnIndex + 1);
    } else {
      setSelectedBlock(null); // Возврат к выбору блока после завершения блока!
    }
    setAnswerSubmitted(false);
    setSelected([]);
    setIsCorrect(null);
    return;
  }
    // Остальной код как был...
    if (current + 1 < quiz.length) {
      setCurrent((c) => c + 1);
      setAnswerSubmitted(false);
      setSelected([]);
      setIsCorrect(null);
    } else {
      if (wrongQuestions.length > 0 && !replayWrong) {
        setQuiz([...wrongQuestions]);
        setCurrent(0);
        setReplayWrong(true);
        setWrongQuestions([]);
        setAnswerSubmitted(false);
        setSelected([]);
        setIsCorrect(null);
      } else {
        if (mode === "final") {
          const total = quiz.length;
          const correctCount = total - errors;
          setAttempts((prev) => [
            ...prev,
            {
              date: new Date().toLocaleString(),
              total,
              correct: correctCount,
              incorrect: errors,
            },
          ]);
        }
        setCompleted(true);
        setAnswerSubmitted(false);
        setSelected([]);
        setIsCorrect(null);
      }
    }
  };









  const restart = () => {
    setQuiz([]);
    setCurrent(0);
    setSelected([]);
    setIsCorrect(null);
    setErrors(0);
    setWrongQuestions([]);
    setReplayWrong(false);
    setCompleted(false);
    setLimit(null);
    setMode("menu");
    setNoDifficult(false);
  };

  const arraysEqualIgnoreOrder = (a, b) =>
    a.length === b.length && a.every((val) => b.includes(val));
    
  const handleExport = () => {
    const data = {
    attempts,
    wrongCounts,
    learnProgress
  };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "quiz_stats.json";
    a.click();

    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.attempts) setAttempts(data.attempts);
          if (data.wrongCounts) {
            setWrongCounts(data.wrongCounts);
            setWrongCountsLoaded(true);
          }
          if (data.learnProgress) setLearnProgress(data.learnProgress); // ← ВОТ ЭТА СТРОКА
        } catch (err) {
          alert("Ошибка при чтении файла: " + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const menuOptions = [
    {
      label: "🧪 Финальный прогон",
      onClick: () => { setLimit(questions.length); setMode("final"); }
    },
    ...[10, 20, 50, 100].map(n => ({
      label: `${n} вопросов`,
      onClick: () => { setLimit(n); setMode("quiz"); }
    })),
    {
      label: "📌 Часто ошибочные вопросы",
      onClick: () => setMode("difficult")
    },
    {
      label: "📚 Режим заучивания",
      onClick: () => setMode("learn")
    },
    {
      label: "📤 Экспорт статистики",
      onClick: handleExport
    },
    {
      label: "📥 Импорт статистики",
      onClick: handleImport
    },
    {
      label: "🧹 Сбросить статистику",
      onClick: () => {
        if (confirm("Вы уверены, что хотите сбросить всю статистику?")) {
          setAttempts([]);
          setWrongCounts({});
          localStorage.removeItem("quizAttempts");
          localStorage.removeItem("quizWrongCounts");
        }
      }
    }
  ];


  if (mode === "menu") {
    return (
      <div className="quiz-container text-center" style={{ display: "flex", justifyContent: "space-between", gap: "2rem" }}>
        <div style={{ flex: 1 }}>
          <h2 className="question-title">Выберите режим:</h2>
          <div className="answers" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-start" }}>
            {menuOptions.map((opt, idx) => (
              <button
                key={opt.label}
                onClick={opt.onClick}
                className={menuIndex === idx ? "selected" : ""}
                style={{
                  background: menuIndex === idx ? "#D7ECFF" : undefined,
                  fontWeight: menuIndex === idx ? "bold" : undefined,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {attempts.length > 0 && (
          <div className="stats" style={{ flex: 1, background: "#f8f9fa", padding: "1rem", borderRadius: "8px", textAlign: "left" }}>
            <h3>📈 Статистика финальных прогонов:</h3>
            <ul style={{ listStyle: "none", paddingLeft: 0 }}>
              {attempts.map((a, i) => (
                <li key={i} style={{ marginBottom: "0.5rem" }}>
                  <strong>{a.date}</strong>: {a.correct}/{a.total} — {Math.round((a.correct / a.total) * 100)}%
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Новый: выбор блока в режиме заучивания
  if (mode === "learn" && selectedBlock === null) {
    return (
      <div className="quiz-container text-center">
        <h2 className="question-title">Выберите блок для заучивания</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
          {blocks.map((block, i) => (
            <button
              key={i}
              onClick={() => setSelectedBlock(i)}
              style={{ minWidth: "120px" }}
            >
              {`Блок ${i + 1}: ${i * blockSize + 1}–${i * blockSize + block.length}`}<br />
              {block.filter(q => (learnProgress[q.id]?.streak || 0) >= 3).length} / {block.length} выучено
            </button>
          ))}
        </div>
        <div style={{ marginTop: "1rem" }}>
          <span>Размер блока: </span>
          {[5, 10, 20, 50].map(n => (
            <button key={n} onClick={() => setBlockSize(n)} style={{ margin: "0 0.2rem" }}>
              {n}
            </button>
          ))}
        </div>
        <button onClick={restart}>Назад</button>
      </div>
    );
  }

  if (noDifficult) {
    return (
      <div className="quiz-container text-center">
        <h2 className="question-title">Нет сложных вопросов</h2>
        <p className="question-text">Вы пока не ошибались достаточно часто, чтобы составить список.</p>
        <div className="controls">
          <button onClick={restart}>Назад в меню</button>
        </div>
      </div>
    );
  }

  if (
    (mode === "learn" && selectedBlock !== null && learnBlock.length === 0) ||
    (mode !== "learn" && quiz.length === 0)
  ) {
    return <div className="quiz-container">Загрузка вопросов...</div>;
  }

  if (completed) {
    return (
      <div className="quiz-container text-center">
        <h2 className="question-title">✅ Квиз завершён</h2>
        <p className="question-text">Ошибок допущено: {errors}</p>
        <div className="controls">
          <button onClick={restart}>Назад в меню</button>
        </div>
      </div>
    );
  }

  if (!q) return <div className="quiz-container">Загрузка вопросов...</div>;

  const correctAnswerText = isMultiple(q)
    ? q.answers.map((i) => q.options[i]).join(", ")
    : q.options[q.answer];

  return (
    <div className="quiz-container">
      <div className="progress-bar" style={{ width: `${((current + 1) / quiz.length) * 100}%` }}></div>
      <h2 className="question-title">
        Вопрос {mode === "learn" ? learnIndex + 1 : current + 1} из {mode === "learn" ? learnBlock.length : quiz.length}
      </h2>
      <div className="question-text">{q.question}</div>
      {q.image && (
        <div className="question-image">
          <img
            src={`${import.meta.env.BASE_URL}${q.image.replace(/^\//, '')}`}
            alt="изображение к вопросу"
            style={{ maxWidth: "100%", margin: "1rem auto", display: "block" }}
          />
        </div>
      )}
      <div className="answers">
        {q.options.map((opt, idx) => {
          const selectedThis = selected.includes(idx);
          // выделяем, если выбран только один и это он
          const isFocused = selected.length === 1 && selected[0] === idx;
          let className = "";
          if (answerSubmitted) {
            if ((isMultiple(q) && q.answers.includes(idx)) ||
                (!isMultiple(q) && q.answer === idx)) {
              if (selectedThis) className = "correct";
            } else if (selectedThis) className = "wrong";
          } else if (selectedThis) {
            className = "selected";
          }
          return (
            <button
              key={idx}
              onClick={() => handleAnswer(idx)}
              disabled={answerSubmitted}
              className={className}
              style={isFocused ? { outline: "2px solid #3498db" } : undefined}
            >
              {opt}
            </button>
          );
        })}
      </div>


      {isCorrect !== null && (
        <div className="feedback" style={{ marginTop: "1rem", fontWeight: "bold", fontSize: "1.2em" }}>
          {isCorrect ? "✅ Верно!" : `❌ Неверно. Правильный ответ: ${correctAnswerText}`}
        </div>
      )}
      <div className="controls">
        <button onClick={restart}>Завершить</button>
        {!answerSubmitted ? (
          <button
            onClick={submitAnswer}
            disabled={selected.length === 0}
          >
            Проверить
          </button>
        ) : (
          <button onClick={next}>Далее</button>
        )}

        {mode === "learn" && selectedBlock !== null && (
          <button onClick={() => setSelectedBlock(null)}>
            Назад к выбору блока
          </button>
        )}
      </div>
    </div>
  );
}
