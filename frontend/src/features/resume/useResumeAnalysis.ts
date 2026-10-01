import { useEffect, useRef, useState } from 'react';
import { analyzeResume } from '../../api/client.js';
import type {
  EmploymentCorrection,
  ResumeAnalysis,
  ResumeCorrections,
  ResumeInput,
} from '../../api/client.js';

export function useResumeAnalysis() {
  const [text, setInput] = useState('');
  const [submission, setSubmission] = useState<ResumeInput | null>(null);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const manualId = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!submission) {
      return;
    }

    const controller = new AbortController();

    activeRequest.current = controller;

    const timer = window.setTimeout(
      () => {
        void analyzeResume(submission, controller.signal)
          .then((result) => {
            if (!controller.signal.aborted) {
              setAnalysis(result);
              setLoading(false);
            }
          })
          .catch((reason: unknown) => {
            if (!controller.signal.aborted) {
              setError(reason instanceof Error ? reason.message : 'Could not analyze this text.');
              setLoading(false);
            }
          });
      },
      submission.corrections ? 350 : 0,
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [submission]);

  const clear = () => {
    activeRequest.current?.abort();
    setInput('');
    setSubmission(null);
    setAnalysis(null);
    setLoading(false);
    setError('');
    manualId.current = 0;
  };

  const setText = (value: string) => {
    activeRequest.current?.abort();
    setInput(value);
    setSubmission(null);
    setAnalysis(null);
    setLoading(false);
    setError('');
  };

  const analyze = () => {
    activeRequest.current?.abort();
    setAnalysis(null);
    setError('');
    setLoading(true);
    setSubmission({ text });
  };

  const correct = (changes: ResumeCorrections) => {
    if (!analysis) {
      return;
    }

    activeRequest.current?.abort();
    setLoading(true);
    setError('');

    setSubmission((current) => ({
      text,
      analysisDate: analysis.analysisDate,
      corrections: { ...current?.corrections, ...changes },
    }));
  };

  const editEmployment = (id: string, changes: Omit<EmploymentCorrection, 'id'>) => {
    const entries = submission?.corrections?.employment ?? [];
    const previous = entries.find((entry) => entry.id === id);

    correct({
      employment: [...entries.filter((entry) => entry.id !== id), { ...previous, id, ...changes }],
    });
  };

  const addEmployment = () => {
    manualId.current++;

    editEmployment(`manual-${manualId.current}`, {
      employer: '',
      title: '',
      start: '',
      end: '',
      category: 'unclassified',
      kind: 'employment',
      relationship: 'unknown',
    });
  };

  const addSignal = (kind: 'skills' | 'competencies', name: string) => {
    const key = kind === 'skills' ? 'addSkills' : 'addCompetencies';
    const names = submission?.corrections?.[key] ?? [];

    correct({ [key]: [...new Set([...names, name.trim()])].filter(Boolean) });
  };

  const removeSignal = (kind: 'skills' | 'competencies', signal: { id: string; name: string }) => {
    const add = kind === 'skills' ? 'addSkills' : 'addCompetencies';
    const remove = kind === 'skills' ? 'removeSkills' : 'removeCompetencies';

    correct({
      [add]: (submission?.corrections?.[add] ?? []).filter(
        (name) => name.toLowerCase() !== signal.name.toLowerCase(),
      ),
      [remove]: [...new Set([...(submission?.corrections?.[remove] ?? []), signal.id])],
    });
  };

  return {
    text,
    setText,
    analysis,
    loading,
    error,
    clear,
    analyze,
    corrections: submission?.corrections ?? {},
    correct,
    editEmployment,
    addEmployment,
    addSignal,
    removeSignal,
  };
}
