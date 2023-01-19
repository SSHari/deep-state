export type BaseComponent = (props: any) => JSX.Element;

export type RemoveDefaultPropsFromRequired<ComponentProps, DefaultProps> = Omit<
  ComponentProps,
  keyof DefaultProps
> & {
  [Key in keyof DefaultProps]?: DefaultProps[Key];
};

export type RequireProperty<T, U extends keyof T> = Omit<T, U> &
  Required<Pick<T, U>>;
