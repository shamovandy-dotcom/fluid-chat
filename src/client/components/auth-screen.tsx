"use client";

import { useState } from "react";
import { api, ApiError } from "../api";
import { identifyUser, track } from "../analytics";
import { useApp } from "../store";

export function AuthScreen() {
  const { actions } = useApp();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      if (mode === "forgot") {
        const { resetToken } = await api.auth.forgotPassword(email);
        setNotice(
          resetToken
            ? `На сервере не настроена отправка писем. Вот ссылка для сброса пароля: /reset-password/${resetToken}`
            : "Если аккаунт с таким адресом существует, ссылка для сброса пароля будет отправлена."
        );
        setBusy(false);
        return;
      }

      const result =
        mode === "signup"
          ? await api.auth.signup({ email, password, displayName })
          : await api.auth.login(email, password);
      actions.setSession(result.user, result.workspaces);
      // Identify before capturing so the conversion lands on the person, not the anonymous id.
      identifyUser(result.user);
      track(mode === "signup" ? "signed_up" : "signed_in", { workspace_count: result.workspaces.length });
      if (result.workspaces[0]) await actions.selectWorkspace(result.workspaces[0].workspace.id);
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : "Что-то пошло не так");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <a className="auth-brand" href="https://androlit.ru/" target="_blank" rel="noreferrer" aria-label="АНДРОЛИТ — официальный сайт">
          <span className="auth-brand-name"><span>АНДР</span><span>ОЛИТ</span></span>
          <span className="auth-brand-caption">НЕРУДНЫЕ МАТЕРИАЛЫ ДЛЯ СТРОИТЕЛЬСТВА</span>
        </a>
        <p className="eyebrow">Корпоративное пространство</p>
        <h1>АНДРОЛИТ<br /><span>на связи.</span></h1>
        <p className="lede">
          Внутренний мессенджер команды АНДРОЛИТ — рабочие обсуждения, сообщения и файлы в одном пространстве.
        </p>
        <ul className="auth-points">
          <li>Командные каналы и личные сообщения</li>
          <li>Обсуждения, упоминания и быстрые реакции</li>
          <li>Обмен файлами и история переписки</li>
          <li>Рабочая коммуникация в едином цифровом пространстве</li>
        </ul>
        <a className="auth-site-link" href="https://androlit.ru/" target="_blank" rel="noreferrer">androlit.ru <span aria-hidden="true">↗</span></a>
      </section>

      <section className="auth-panel">
        <div className="segmented">
          <button type="button" className={mode === "login" ? "is-active" : ""} onClick={() => setMode("login")}>
            Войти
          </button>
          <button type="button" className={mode === "signup" ? "is-active" : ""} onClick={() => setMode("signup")}>
            Создать аккаунт
          </button>
        </div>

        <form className="stack-form" onSubmit={submit}>
          {mode === "signup" ? (
            <label className="field">
              Имя и фамилия
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required autoComplete="name" />
            </label>
          ) : null}
          <label className="field">
            Электронная почта
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </label>
          {mode !== "forgot" ? (
            <label className="field">
              Пароль
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </label>
          ) : null}

          <button type="submit" className="button primary" disabled={busy}>
            {mode === "signup" ? "Создать аккаунт" : mode === "forgot" ? "Отправить ссылку" : "Войти"}
          </button>

          {mode === "login" ? (
            <button type="button" className="link-button" onClick={() => setMode("forgot")}>
              Забыли пароль?
            </button>
          ) : null}
          {mode === "forgot" ? (
            <button type="button" className="link-button" onClick={() => setMode("login")}>
              Вернуться ко входу
            </button>
          ) : null}
          {notice ? <p className="notice">{notice}</p> : null}
        </form>
      </section>
    </main>
  );
}

export function WorkspaceSetupScreen() {
  const { state, actions } = useApp();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <p className="eyebrow">Добро пожаловать, {state.session?.displayName}</p>
        <h1>Создайте первое рабочее пространство.</h1>
        <p className="lede">
          В рабочем пространстве находятся каналы, участники и история переписки. Позже можно создать дополнительные пространства или присоединиться к существующему по приглашению.
        </p>
      </section>
      <section className="auth-panel">
        <form
          className="stack-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              const { workspace } = await api.workspaces.create(name);
              track("workspace_created", {});
              const { user, workspaces } = await api.auth.me();
              actions.setSession(user, workspaces);
              await actions.selectWorkspace(workspace.id);
            } catch (error) {
              actions.fail(error);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            Название рабочего пространства
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, АНДРОЛИТ" required autoFocus />
          </label>
          <button type="submit" className="button primary" disabled={busy || name.trim().length < 2}>
            Создать рабочее пространство
          </button>
          <button type="button" className="link-button" onClick={() => void actions.signOut()}>
            Выйти из аккаунта
          </button>
        </form>
      </section>
    </main>
  );
}
