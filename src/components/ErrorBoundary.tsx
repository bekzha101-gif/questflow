import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('QuestFlow Uncaught Error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090c] text-white flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center text-3xl mb-4 shadow-2xl shadow-rose-950/50 animate-bounce">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <h1 className="text-xl font-bold text-white mb-1">Что-то пошло не так</h1>
          <p className="text-xs text-white/50 max-w-sm mb-6 leading-relaxed">
            Произошла непредвиденная ошибка в интерфейсе. Ваши данные сохранены в облаке.
          </p>

          <button
            onClick={this.handleReload}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-950/50 transition-all flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Перезагрузить приложение</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
