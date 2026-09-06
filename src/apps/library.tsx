import React from "react";
import { mount } from "./mount";
import { goto } from "../Shell";
import Library from "../screens/Library";
mount("library", <Library onOpen={(it) => goto("reader", { open: it.id })} />);
