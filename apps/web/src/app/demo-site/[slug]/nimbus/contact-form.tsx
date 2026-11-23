"use client";
import { useState } from "react";

// A demo company cannot receive mail, so the form says so instead of posting anywhere.
export function ContactForm() {
  const [sent, setSent] = useState(false);
  return (
    <form className="nb-form" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
      <div className="nb-form-row">
        <label>Full name<input name="name" autoComplete="name" required /></label>
        <label>Work email<input name="email" type="email" autoComplete="email" required /></label>
      </div>
      <div className="nb-form-row">
        <label>Company<input name="company" autoComplete="organization" /></label>
        <label>I&apos;m interested in
          <select name="topic" defaultValue="services">
            <option value="services">IT services</option>
            <option value="trial">NimbusOps free trial</option>
            <option value="plans">NimbusOps plans and pricing</option>
            <option value="other">Something else</option>
          </select>
        </label>
      </div>
      <label>How can we help?<textarea name="message" rows={4} /></label>
      <button className="nb-btn nb-btn-primary" type="submit">Send message</button>
      {sent && (
        <p className="nb-form-note" role="status">
          Thanks. Nimbus is a fictional demo company, so nothing was sent. Ask the chat bubble instead: it answers from Nimbus&apos;s public documents.
        </p>
      )}
    </form>
  );
}
