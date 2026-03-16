import React from "react";
import { Button } from "./Button";

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: ""
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message ?? "An unexpected error occurred."
    };
  }

  componentDidCatch(error) {
    console.error("AppErrorBoundary", error);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface-50 px-4">
          <div className="card-surface w-full max-w-md p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
              <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-base font-bold text-ink-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-ink-500">{this.state.errorMessage}</p>
            <Button className="mt-5" onClick={this.handleReload}>
              Reload App
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
