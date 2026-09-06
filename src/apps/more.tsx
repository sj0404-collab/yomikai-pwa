import React, { useState } from "react";
import { mount } from "./mount";
import { loadTabsCfg, saveTabsCfg, type TabsCfg } from "../tabs";
import More from "../screens/More";
function Root() {
  const [cfg, setCfg] = useState<TabsCfg>(loadTabsCfg);
  return (
    <More
      cfg={cfg}
      setCfg={(c) => {
        setCfg(c);
        saveTabsCfg(c);
      }}
    />
  );
}
mount("more", <Root />);
