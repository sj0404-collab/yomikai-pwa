import React from "react";
import { mount } from "./mount";
import { goto } from "../Shell";
import Browse from "../screens/Browse";
mount("browse", <Browse onOpen={(it) => goto("reader", { open: it.id })} goWeb={(url) => goto("web", { url })} />);
