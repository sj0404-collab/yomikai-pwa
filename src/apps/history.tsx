import React from "react";
import { mount } from "./mount";
import { goto } from "../Shell";
import History from "../screens/History";
mount("history", <History onOpen={(it) => goto("reader", { open: it.id })} />);
