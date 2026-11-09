import { Component, type ErrorInfo, type ReactNode } from 'react';

type State = { failed: boolean };

/** Last line of defence: a render crash shows a plain message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error while rendering', error, info.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <p role="alert" className="m-0 p-6 text-lg text-shell-text">
        Something went wrong. Reload the page.
      </p>
    );
  }
}
