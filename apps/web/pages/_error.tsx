import type { NextPageContext } from "next";

function ErrorPage({ statusCode }: { statusCode: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#ffffff", color: "#111827" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 300 }}>{statusCode}</h1>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default ErrorPage;
