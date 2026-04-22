import { RouterProvider } from "react-router";
import { router } from "./routes";
import { FinanceProvider } from "./lib/finance-context";
import { AuthProvider } from "./lib/auth-context";
import { ThemeProvider } from "./lib/theme-context";

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <FinanceProvider>
          <RouterProvider router={router} />
        </FinanceProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}