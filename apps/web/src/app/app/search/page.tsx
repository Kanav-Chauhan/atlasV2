import { QueryProvider } from "@/components/query";
import { Search } from "./search";
import "./search.css";

// Everyone can search. The API's suggested questions aren't exposed yet, so the idle examples are generic.
const EXAMPLES = ["leave carry forward", "password and MFA rules", "travel allowance for a metro city"];

export default function SearchPage() {
  return (
    <QueryProvider>
      <Search examples={EXAMPLES} />
    </QueryProvider>
  );
}
