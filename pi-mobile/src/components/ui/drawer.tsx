import type { ComponentProps } from "solid-js";
import { Show, mergeProps, splitProps } from "solid-js";
import DrawerPrimitive from "@corvu/drawer";

import { cx } from "@/lib/cva";

export const DrawerPortal = DrawerPrimitive.Portal;

type DrawerProps = ComponentProps<typeof DrawerPrimitive>;

export const Drawer = (props: DrawerProps) => {
  return <DrawerPrimitive data-slot="drawer" {...props} />;
};

type DrawerContentProps = ComponentProps<typeof DrawerPrimitive.Content> & {
  withHandle?: boolean;
};

export const DrawerContent = (props: DrawerContentProps) => {
  const context = DrawerPrimitive.useContext();

  const merge = mergeProps(
    {
      withHandle: context.side() === "bottom",
    },
    props,
  );
  const [, rest] = splitProps(merge, ["class", "children", "withHandle"]);

  return (
    <>
      <DrawerPrimitive.Overlay
        data-slot="drawer-overlay"
        class="fixed inset-0 z-50 bg-black/50 data-[transitioning]:transition-colors data-[transitioning]:duration-500 data-[transitioning]:ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          "background-color": `rgb(0 0 0 / ${0.5 * context.openPercentage()}`,
        }}
      />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        class={cx(
          "bg-background fixed z-50 flex h-auto flex-col after:absolute after:bg-inherit data-[transitioning]:transition-transform data-[transitioning]:duration-500 data-[transitioning]:ease-[cubic-bezier(0.32,0.72,0,1)]",
          context.side() === "bottom" && [
            "inset-x-0 bottom-0 mt-24 max-h-[80vh] rounded-t-lg border-t",
            "after:inset-x-0 after:top-[calc(100%-1px)] after:h-1/2",
          ],
          context.side() === "top" && [
            "inset-x-0 top-0 mb-24 max-h-[80vh] rounded-b-lg border-b",
            "after:inset-x-0 after:bottom-[calc(100%-1px)] after:h-1/2",
          ],
          context.side() === "left" && [
            "inset-y-0 left-0 w-3/4 border-r sm:max-w-sm",
            "after:inset-y-0 after:right-[calc(100%-1px)] after:w-1/2",
          ],
          context.side() === "right" && [
            "inset-y-0 right-0 w-3/4 border-l sm:max-w-sm",
            "after:inset-y-0 after:left-[calc(100%-1px)] after:w-1/2",
          ],
          props.class,
        )}
        {...rest}
      >
        <Show when={props.withHandle}>
          <div
            class={cx(
              "bg-muted shrink-0 self-center rounded-full",
              context.side() === "bottom" && "mt-4 h-1 w-10",
            )}
          />
        </Show>
        {props.children}
      </DrawerPrimitive.Content>
    </>
  );
};

type DrawerLabelProps = ComponentProps<typeof DrawerPrimitive.Label>;

export const DrawerLabel = (props: DrawerLabelProps) => {
  const [, rest] = splitProps(props, ["class"]);

  return (
    <DrawerPrimitive.Label
      data-slot="drawer-label"
      class={cx("text-foreground font-semibold", props.class)}
      {...rest}
    />
  );
};

