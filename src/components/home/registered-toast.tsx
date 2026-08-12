"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Suspense } from "react";

function RegisteredToastInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      toast.success("注册成功！请查看邮箱验证链接以激活你的账号。");
    }
  }, [searchParams]);

  return null;
}

export function RegisteredToast() {
  return (
    <Suspense fallback={null}>
      <RegisteredToastInner />
    </Suspense>
  );
}
